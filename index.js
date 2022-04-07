const express = require('express')

const bcrypt = require('bcrypt')
const session = require('express-session')
const flash = require('express-flash')

const app = express()
const port = process.env.PORT || 5000

const db = require('./connection/db')
const upload = require('./middlewares/fileUpload')

app.set('view engine', 'hbs') // set view engine hbs
app.use('/public', express.static(__dirname + '/public')) // set public path/folder
app.use('/uploads', express.static(__dirname + '/uploads')) // set public path/folder

app.use(express.urlencoded({extended: false}))

app.use(flash())

app.use(session({
    secret: 'security',
    resave: false,
    saveUninitialized: true,
    cookie: { 
        maxAge: 2 * 60 * 60 * 1000 // 2 jam
    }
}))

// let isLogin = true

// app.get('/blog', function(req, res){
//     res.render('blog')
// })

app.get('/contact', function(req, res) {
    res.render('contact')
})

app.get('/blog', function(req, res){
    if(!req.session.isLogin){
        req.flash('danger', 'Silahkan Login Terlebih Dahulu')
        res.redirect('/login')
    }

    res.render('blog')
})

app.get('/', function(req, res) {

    let userID;
    let query;
    if(req.session.isLogin){
        userID = req.session.user.id
        query = `SELECT tb_blog.id, tb_user.name as author, tb_user.email, tb_blog.project, tb_blog.inputstart, tb_blog.inputend, tb_blog.description, tb_blog.technologies, tb_blog.image FROM tb_blog LEFT JOIN tb_user ON tb_blog.author_id = tb_user.id WHERE author_id=${userID} ORDER BY tb_blog.id ASC`
    } else{
        query = `SELECT tb_blog.id, tb_user.name as author, tb_user.email, tb_blog.project, tb_blog.inputstart, tb_blog.inputend, tb_blog.description, tb_blog.technologies, tb_blog.image FROM tb_blog LEFT JOIN tb_user ON tb_blog.author_id = tb_user.id ORDER BY tb_blog.id ASC`
    }
    db.connect(function(err, client, done){
        if (err) throw err // untuk menampilkan error koneksi database

        client.query(query, function(err, result) {
            if (err) throw err // untuk menampilkan error query

            let data = result.rows

            data = data.map(function(item){
                return{
                    ...item,
                    isLogin: req.session.isLogin,
                    description: item.description.slice(0, 150) + '....',
                    duration: getDate(item.inputstart , item.inputend)
                }
            })

           res.render('index', {isLogin: req.session.isLogin, user: req.session.user, blogs: data})
        })
    })

})

app.post('/blog', upload.single('inputImage'), function(req, res){

    let data = req.body

    const image = req.file.filename
    const authorId = req.session.user.id

    let node = data.inputNode
    let react = data.inputReact
    let javascript = data.inputJavascript
    let html = data.inputHtml

    let array = [node, react, javascript, html]
    let cek = array.filter (function(item){
        return item !== undefined
        
    }) 

    // console.log(cek);

    db.query(
    "INSERT INTO tb_blog (project, inputstart, inputend, description, technologies, image, author_id) VALUES ($1, $2, $3, $4, $5, $6, $7)",
    [
      data.inputProject,
      // buat array untuk di masukkan ke db
      data.inputStart,
      data.inputEnd,
      data.inputDescription,
      cek,
      image,
      authorId
    ],
    (error, results) => {
      if (error) {
        throw error;
      }
      res.redirect("/");
    }
  );


})

app.get('/blog-detail/:id', function(req, res) {
    
    let id = req.params.id
    db.connect(function (err, client, done) {
        if (err) throw err

        client.query(`SELECT * FROM tb_blog WHERE id = ${id}`, function(err, result) {
            if (err) throw err
            done();

            let data = result.rows

            databaru = data.map(function(item){
                return{
                    ...item,
                    duration: getDate(item.inputstart , item.inputend)
                }
            })
            // console.log(databaru);

            res.render('blog-detail', {blogs: databaru[0]})
        })
    })
})


app.get('/delete-blog/:id', function(req, res){

    // console.log(req.params.id);
    const id = req.params.id

    const query = `DELETE FROM tb_blog WHERE id=${id};`

    db.connect(function(err, client, done) {
        if (err) throw err

        client.query(query, function(err, result){
            if (err) throw err
            done()

            res.redirect('/') // untuk berpindah halaman
        })
    })
})

app.get ('/update-blog/:id', (req, res) =>{

    let id =  req.params.id
    // console.log(id);
    db.connect((err, client, done) => {
        if (err) throw err

        client.query (`SELECT * FROM tb_blog WHERE id = ${id}`, (err, result) =>{
            if (err) throw err
            done()
            let data = result.rows[0]

            // console.log(data);
            res.render('update-blog', {edit: data, id})
        })
    })
})

app.post('/update-blog/:id', upload.single('inputImage'), function(req, res){
    let data = req.body
    let id = req.params.id
    let node = data.inputNode
    let react = data.inputReact
    let javascript = data.inputJavascript
    let html = data.inputHtml
    let array = [node, react, javascript, html]
    let cek = array.filter (function(item){
        return item !== undefined
    })
    let image = ""
    if(req.file != null){
        image = req.file.filename
    } else{
        image = data.image
    }
    // console.log(id);
    db.connect((err, client, done) => {
        if (err) throw err
        client.query (`UPDATE tb_blog SET project=$1, inputstart=$2, inputend=$3, description=$4, technologies=$5, image = $6 WHERE id =  ${id};`, 
        [
            data.inputProject,
        // buat array untuk di masukkan ke db
            data.inputStart,
            data.inputEnd,
            data.inputDescription,
            cek,
            image,
        ],
        (err, result) =>{
            if (err) throw err
            done()
            res.redirect('/')
        })
    })
})

app.get('/login', function(req, res){
    res.render('login')
})

app.post('/login', function(req, res){
    
    const {inputEmail, inputPassword} = req.body

    const query = `SELECT * FROM tb_user WHERE email='${inputEmail}'`

    db.connect(function(err, client, done) {
        if (err) throw err

        client.query(query, function(err, result){
            if (err) throw err
            done()

            // melakukan kondisi jika email belum terdaftar
            if(result.rows.length == 0){
                // console.log('Email not found!!');
                req.flash('danger', 'Email belum terdaftar!')
                return res.redirect('/login')
            }

            const isMatch = bcrypt.compareSync(inputPassword, result.rows[0].password )
            // console.log(isMatch);

            if(isMatch){
                // console.log('Login Berhasil');

                // Memasukan data kedalam session
                req.session.isLogin = true,
                req.session.user = {
                    id: result.rows[0].id,
                    name: result.rows[0].name,
                    email: result.rows[0].email
                }

                req.flash('success', 'Login Success')
                res.redirect('/')
            } else {
                // console.log('Password salah');
                req.flash('danger', 'Password Salah!')
                res.redirect('/login')
            }        
        })
    })
})

app.get('/register', function(req, res){
    res.render('register')
})

app.post('/register', function(req, res){

    // let data = req.body
    let {inputNama, inputEmail, inputPassword} = req.body

    const hashedPassword = bcrypt.hashSync(inputPassword, 10) // 10 hashed/second

    // console.log('password asli', inputPassword);
    // console.log('sudah bcrypt', hashedPassword)

    const query = `INSERT INTO tb_user(name, email, password) VALUES ('${inputNama}', '${inputEmail}', '${hashedPassword}');`

    db.connect(function(err, client, done) {
        if (err) throw err

        client.query(query, function(err, result){
            if (err) throw err
            done()

            res.redirect('/login') // untuk berpindah halaman
        })

    })

})

app.get('/logout', function(req, res){
    req.session.destroy()

    res.redirect('/')
})




function getDate(start, end) {

    let inputStart = new Date(start);
    let inputEnd = new Date(end);
    let hasil = inputEnd - inputStart;
    let milisecond = 1000;
    let second = 3600;
    let hours = 24;
    let day = Math.floor(hasil / (milisecond * second * hours));
    let month = Math.floor(day / 30);


    if (day <= 30) {
        return `${day} hari`;
    } else if (day > 30 ) {
        return `${month} bulan`;
    }
}




app.listen(port, function(){
    console.log(`Server listen on port ${port}`);
})