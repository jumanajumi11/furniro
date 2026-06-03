import multer from 'multer';

const storage = multer.diskStorage({
    destination: function (req, file, cb) {
        cb(null, 'public/upload/');
    },
    filename: function (req, file, cb) {
        const name = Date.now() + '-' + file.originalname.replace(/\s+/g, '-');
        cb(null, name);
    }
});

const upload = multer({ storage: storage });

export default upload;
