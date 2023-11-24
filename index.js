const express = require('express');
const cors = require('cors');
const app = express();
const port = process.env.PORT || 5000;

app.use(express.json())
app.use(cors())

app.get('/', (req, res) => {
    res.send('my Polling & Survey is Rinning now')
})
app.listen(port, () => {
    console.log(`P & S app listing on port ${port}`);
})
