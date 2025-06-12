const express = require('express');
const app = express();
const path = require('path'); 
const webRoutes = require('./routes/web');
const { router: bucketRoutes } = require('./routes/buckets');
const fileRoutes = require('./routes/files');
const multer = require('multer');
const upload = multer({ dest: 'private/' });
const uploadRouter = require('./routes/uploads');
const apiRoutes = require('./routes/api');

app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(express.static('public'));
app.use('/css', express.static(path.join(__dirname, 'src/css')));
app.use('/js', express.static(path.join(__dirname, 'src/js')));
app.use('/public/images', express.static(path.join(__dirname, 'public/images')));
app.use((err, req, res, next) => {
    if (err instanceof multer.MulterError) {
        return res.status(400).json({ error: err.message });
    } else if (err) {
        return res.status(500).json({ error: err.message });
    }
    next();
});



app.use(express.static(path.join(__dirname, 'public')));

app.use('/', apiRoutes);
app.use('/', webRoutes);
app.use('/', bucketRoutes);
app.use('/', fileRoutes);
app.use('/', uploadRouter);

app.post('/api/upload', upload.array('files'), (req, res) => {
    res.json({ files: req.files });
});

app.get('/404', (req, res) => {
    res.status(404).sendFile(path.join(__dirname, 'src/html/404.html'));
});

app.get('/403', (req, res) => {
    res.status(403).sendFile(path.join(__dirname, 'src/html/403.html'));
});

app.use((req, res, next) => {
    res.status(403).redirect('/403');
});


app.use((err, req, res, next) => {
    console.error('Global error handler:', err);

    if (err.status === 403) {
        return res.status(403).sendFile(path.join(__dirname, 'src/html/403.html'));
    }

    if (err.status === 404) {
        return res.status(404).sendFile(path.join(__dirname, 'src/html/404.html'));
    }

    res.status(500).send('Internal Server Error');
});

const PORT = process.env.PORT || 8080;
app.listen(PORT, () => {
    console.log(`Сервер PasteBin працює по такому адресу: http://localhost:${PORT}`);
    console.log(`Порт: ${PORT}`);
    console.log(`Сервер готовий приймати з'єднання`);
});