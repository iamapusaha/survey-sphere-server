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
        // verify token 
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
        // verify admin 
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

        //user related api
        // api for change user role
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
        // api for added user 
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


        //api for check user admin or not
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
        // api for get all users, or get usr by his.her role
        app.get('/users/:role?', async (req, res) => {
            let query = {};
            if (req.params.role) {
                query.role = req.params.role
            }
            const result = await userCollection.find(query).toArray();
            res.send(result)
        })
        // api for delete user
        app.delete('/users/:id', async (req, res) => {
            const id = req.params.id;
            const qurey = { _id: new ObjectId(id) }
            const result = await userCollection.deleteOne(qurey);

            res.send(result)
        })



        //Survey related api
        // a api for post a survey 
        app.post('/surveys', verifyToken, async (req, res) => {
            const survey = req.body;
            const result = await surveyCollection.insertOne(survey);
            res.send(result)
        })
        // api for get all surveys 
        app.get('/surveys', async (req, res) => {
            const result = await surveyCollection.find().toArray()
            res.send(result)
        })
        // api for get survey by id
        app.get('/survey/:id', async (req, res) => {
            const id = req.params.id;
            const query = { _id: new ObjectId(id) };
            const result = await surveyCollection.findOne(query);
            res.send(result)
        })
        // api for added like or dislike
        app.patch('/survey/likedis/:id', async (req, res) => {
            const id = req.params.id;
            const { like, dislike } = req.body;
            const query = { _id: new ObjectId(id) }
            const survey = await surveyCollection.findOne(query);

            const totalLikes = survey.like + like;
            const totalDislikes = survey.dislike + dislike;
            const updateDoc = {
                $set: {
                    like: totalLikes,
                    dislike: totalDislikes
                }
            }
            const result = await surveyCollection.updateOne(query, updateDoc);
            res.send(result)
        })
        // api for added comment
        app.patch('/survey/comment/:id', async (req, res) => {
            const id = req.params.id;
            const comment = req.body;
            const filter = { _id: new ObjectId(id) };
            const updateDoc = {
                $push: {
                    comments: {
                        user: comment.user,
                        email: comment.email,
                        comment: comment.comment
                    }
                }
            }
            const result = await surveyCollection.updateOne(filter, updateDoc);
            res.send(result)

        })
        //api for added vote
        app.patch('/survey/vote/:id', async (req, res) => {
            const id = req.params.id;
            const { vote, user } = req.body;
            const { name, email, timestamp, option } = user;
            const { yes, no } = vote;
            const filter = { _id: new ObjectId(id) }
            const collection = await surveyCollection.findOne(filter);

            // Check if the user has already voted
            const hasVoted = collection.votes.some(
                (v) => v.email === email,
            );
            if (hasVoted) {
                return res.send({ message: 'User has already voted' });
            }

            // Calculate the new vote totals
            const totalYes = collection.yes + yes;
            const totalNo = collection.no + no;
            const totalVote = totalYes + totalNo;

            // Prepare the update document
            const updateDoc = {
                $set: {
                    totalVote,
                    yes: totalYes,
                    no: totalNo
                },
                $push: {
                    votes: {
                        user: name,
                        email,
                        timestamp,
                        option
                    }
                }
            }

            // Update the survey document
            const result = await surveyCollection.updateOne(filter, updateDoc);
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
