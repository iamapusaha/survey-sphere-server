const express = require('express');
const cors = require('cors');
const app = express();
const jwt = require('jsonwebtoken');
const uuid = require('uuid');
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
        // verify admin or surveyor
        const verifyAdminOrSurveyor = async (req, res, next) => {
            const email = req.decoded.email;
            const query = { email: email }
            const user = await userCollection.findOne(query);
            const isAllowedRole = user?.role === 'admin' || user?.role === 'surveyor';
            if (!isAllowedRole) {
                console.log('You are not an admin or surveyor');
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


        //api for check user role

        app.get('/user/role/:email', verifyToken, async (req, res) => {
            const email = req.params.email;
            if (email !== req.decoded.email) {
                return res.status(403).send({ message: 'Forbidden access' })
            }
            const query = { email: email };
            const user = await userCollection.findOne(query);
            let role = {};
            if (user) {
                switch (user.role) {
                    case 'admin':
                        role = { admin: true };
                        break;
                    case 'pro-user':
                        role = { proUser: true };
                        break;
                    case 'surveyor':
                        role = { surveyor: true };
                        break;
                    default:
                        role = { user: true };
                }
            }
            res.send(role)
        })


        // api for get all users, or get usr by his.her role
        app.get('/users/:role?', verifyToken, verifyAdmin, async (req, res) => {
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

        app.post('/surveys', verifyToken, verifyAdminOrSurveyor, async (req, res) => {
            const survey = req.body;
            const result = await surveyCollection.insertOne(survey);
            res.send(result)
        })

        // api for get all surveys 
        app.get('/surveys', async (req, res) => {
            const result = await surveyCollection.find().toArray()
            res.send(result)
        })
        //api for get all publish surveys data
        app.get('/publish/surveys', async (req, res) => {
            const query = { status: 'publish' }
            const result = await surveyCollection.find(query).toArray()
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
                        id: uuid.v4(),
                        user: comment.user,
                        email: comment.email,
                        comment: comment.comment
                    }
                }
            }
            const result = await surveyCollection.updateOne(filter, updateDoc);
            res.send(result)

        })
        app.patch('/survey/report/:id', async (req, res) => {
            const id = req.params.id;
            const report = req.body;
            const filter = { _id: new ObjectId(id) };
            const updateDoc = {
                $push: {
                    reports: {
                        id: uuid.v4(),
                        user: report.user,
                        email: report.email,
                        report: report.report
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

            const hasVoted = collection.votes.some(
                (v) => v.email === email,
            );
            if (hasVoted) {
                return res.send({ message: 'User has already voted' });
            }

            const totalYes = collection.yes + yes;
            const totalNo = collection.no + no;
            const totalVote = totalYes + totalNo;

            const updateDoc = {
                $set: {
                    totalVote,
                    timestamp,
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

            const result = await surveyCollection.updateOne(filter, updateDoc);
            res.send(result)
        })
        app.patch('/survey/feedback/:id', async (req, res) => {
            const id = req.params.id;
            const { status, feedback } = req.body;
            const filter = { _id: new ObjectId(id) }

            let updateDoc = {
                $set: {
                    status: status
                }
            }

            if (status === 'unpublish' && feedback) {
                updateDoc.$push = {
                    feedbacks: {
                        id: uuid.v4(),
                        feed: feedback
                    }
                }
            } else if (status === 'publish') {
                updateDoc.$set = {
                    status: status,
                    feedbacks: []
                }
            }

            const result = await surveyCollection.updateOne(filter, updateDoc);
            res.send(result);
        });
        // Delete a Survey 
        app.delete('/survey/:id', async (req, res) => {
            const id = req.params.id;
            const qurey = { _id: new ObjectId(id) }
            const result = await surveyCollection.deleteOne(qurey);

            res.send(result)
        })

        app.patch('/update/survey/:id', async (req, res) => {
            const id = req.params.id;
            const { title, description, image, category, expireIn } = req.body;
            const filter = { _id: new ObjectId(id) };
            const updateDoc = {
                $set: {
                    title,
                    description,
                    image,
                    category,
                    expireIn
                }
            }
            const result = await userCollection.updateOne(filter, updateDoc);
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
