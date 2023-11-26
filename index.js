const express = require('express');
const cors = require('cors');
const app = express();
const jwt = require('jsonwebtoken');
require('dotenv').config()
const { MongoClient, ServerApiVersion, ObjectId } = require('mongodb');
const port = process.env.PORT || 5000;

app.use(express.json())
app.use(cors())



const uri = `mongodb+srv://${process.env.DB_USER}:${process.env.DB_PASS}@cluster0.k1wimiv.mongodb.net/?retryWrites=true&w=majority`;

// Create a MongoClient with a MongoClientOptions object to set the Stable API version
const client = new MongoClient(uri, {
    serverApi: {
        version: ServerApiVersion.v1,
        strict: true,
        deprecationErrors: true,
    }
});

async function run() {
    try {
        // Connect the client to the server	(optional starting in v4.7)
        // await client.connect();
        // Send a ping to confirm a successful connection
        const userCollection = client.db('userDB').collection('users');
        const surveyCollection = client.db('surveyDB').collection('surveys');
        const voteCollection = client.db('voteDB').collection('votes');


        // Auth related api 
        app.post('/jwt', async (req, res) => {
            const user = req.body;
            const token = jwt.sign(user, process.env.ACCESS_TOKEN_SECRET, {
                expiresIn: '1h'
            })
            res.send({ token })
        })

        // middleware 
        const verifyToken = (req, res, next) => {

            // console.log(req.headers.authorization);
            if (!req.headers.authorization) {
                return res.status(401).send({ message: 'Unauthorized access' })
            }
            const token = req.headers.authorization.split(' ')[1];
            jwt.verify(token, process.env.ACCESS_TOKEN_SECRET, (err, decoded) => {
                if (err) {
                    return res.status(401).send({ message: 'Unauthorized access' })
                }
                req.decoded = decoded;
                next()
            })
        }

        const verifyAdmin = async (req, res, next) => {
            const email = req.decoded.email;
            const query = { email: email }
            const user = await userCollection.findOne(query);
            const isAdmin = user?.role === 'admin'
            if (!isAdmin) {
                console.log('tume mia admin na');
                return res.status(403).send({ message: 'Forbidden access' })
            }
            next()
        }

        //vote related api
        app.post('/votes', async (req, res) => {
            const vote = req.body;
            const query = { email: vote.email }
            const isExist = await voteCollection.findOne(query);
            if (isExist) {
                return res.send('user already voted on the survey!')
            }
            const result = await voteCollection.insertOne(vote);
            res.send(result)
        })
        //user related api
        app.patch('/users/role/:id', async (req, res) => {
            const role = req.body.role;
            console.log(role);
            const id = req.params.id;
            const filter = { _id: new ObjectId(id) };
            const updateDoc = {
                $set: {
                    role: `${role}`
                }
            }
            const result = await userCollection.updateOne(filter, updateDoc);
            res.send(result)
        })
        app.post('/users', async (req, res) => {
            const user = req.body;
            const query = { email: user.email }
            const isExist = await userCollection.findOne(query);
            if (isExist) {
                return res.send('user information already exist!')
            }
            const result = await userCollection.insertOne(user);
            res.send(result)
        })
        //check user admin or not
        app.get('/user/admin/:email', verifyToken, async (req, res) => {
            const email = req.params.email;
            if (email !== req.decoded.email) {
                return res.status(403).send({ message: 'Forbidden access' })
            }
            const query = { email: email };
            const user = await userCollection.findOne(query);
            let admin = false;
            if (user) {
                admin = user?.role === 'admin';
            }
            res.send({ admin })
        })
        app.get('/users/:role?', async (req, res) => {
            let query = {};
            if (req.params.role) {
                query.role = req.params.role
            }
            const result = await userCollection.find(query).toArray();
            res.send(result)
        })
        app.delete('/users/:id', async (req, res) => {
            const id = req.params.id;
            const qurey = { _id: new ObjectId(id) }
            const result = await userCollection.deleteOne(qurey);

            res.send(result)
        })

        //Survey related api
        app.post('/surveys', verifyToken, async (req, res) => {
            const survey = req.body;
            const result = await surveyCollection.insertOne(survey);
            res.send(result)
        })
        app.get('/surveys', async (req, res) => {
            const result = await surveyCollection.find().toArray()
            res.send(result)
        })


        await client.db("admin").command({ ping: 1 });
        console.log("Pinged your deployment. You successfully connected to MongoDB!");
    } finally {
        // Ensures that the client will close when you finish/error
        // await client.close();
    }
}
run().catch(console.dir);


app.get('/', (req, res) => {
    res.send('my Polling & Survey is Rinning now')
})
app.listen(port, () => {
    console.log(`P & S app listing on port ${port}`);
})
