module.exports = {
    files: {
        javascripts: {
            joinTo: {
                'app.js': /^app/,
                'vendor.js': /^(?!app)/
            }
        }
    }
};
