const express = require("express");
const app = express();
const port = process.env.PORT || 5000;
const cors = require("cors");
require("dotenv").config();
const jwt = require("jsonwebtoken");
const { MongoClient, ServerApiVersion, ObjectId } = require("mongodb");

// middleWares
app.use(cors());
app.use(express.json());

// verify token
const verifyToken = (req, res, next) => {
    // console.log('Inside verify Token :', req.headers.authorization)
    if (!req.headers.authorization) {
        return res.status(401).send({ message: "Unauthorized Access" });
    }
    const token = req.headers.authorization.split(" ")[1];

    // verify the token
    jwt.verify(token, process.env.ACCESS_TOKEN_SECRET, (err, decoded) => {
        if (err) {
            // console.log('invalid token')
            return res.status(401).send({ message: "Unauthorized Access" });
        }
        req.decoded = decoded;
        next();
    });
};

// ApI
app.get("/", (req, res) => {
    res.send(`Server is running on port : ${port}`);
});

const uri = `mongodb+srv://${process.env.DB_USER}:${process.env.DB_PASSWORD}@cluster0.f30vajg.mongodb.net/?retryWrites=true&w=majority`;
// Create a MongoClient with a MongoClientOptions object to set the Stable API version
const client = new MongoClient(uri, {
    serverApi: {
        version: ServerApiVersion.v1,
        strict: true,
        deprecationErrors: true,
    },
});
async function run() {
    try {
        // Connect the client to the server	(optional starting in v4.7)
        await client.connect();

        const menuCollection = client.db("bistro-boss").collection("menu");
        const reviewCollection = client.db("bistro-boss").collection("reviews");
        const cartCollection = client.db("bistro-boss").collection("carts");
        const userCollection = client.db("bistro-boss").collection("users");

        // middleWare for verify admin
        // Verify admin after verify token
        const verifyAdmin = async (req, res, next) => {
            const email = req.decoded.email;
            const query = { email: email };
            const user = await userCollection.findOne(query);
            const isAdmin = user?.role === "admin";
            if (!isAdmin) {
              return res.status(403).send({ message: 'forbidden access' })
              
            }
          next()
        };

        // JWT related apis
        app.post("/jwt", async (req, res) => {
            const user = req.body;
            const token = jwt.sign(user, process.env.ACCESS_TOKEN_SECRET, {
                expiresIn: "1h",
            });
            res.send({ token });
        });

        //   get all menus
        app.get("/get/all/menu", async (req, res) => {
            const cursor = menuCollection.find();
            const result = await cursor.toArray();
            res.send(result);
        });

        //   post single menu
        app.post("/post/single/menu",verifyToken,verifyAdmin, async (req, res) => {
            const newItem = req.body;
            const result = await menuCollection.insertOne(newItem);
            res.send(result);
        });

        //   get all reveiws
        app.get("/get/reviews", async (req, res) => {
            const result = await reviewCollection.find().toArray();
            res.send(result);
        });

        //  post single cart

        app.post("/post/cart",verifyToken, async (req, res) => {
            const newData = req.body;
            const result = await cartCollection.insertOne(newData);
            res.send(result);
        });

        // get carts
        app.get("/get/carts",verifyToken, async (req, res) => {
            const email = req.query.email;
            const query = { email: email };
            const result = await cartCollection.find(query).toArray();
            res.send(result);
        });

        // delet cart
        app.delete("/cart/:id",verifyToken, async (req, res) => {
            const id = req.params.id;
            const query = { _id: new ObjectId(id) };
            const result = await cartCollection.deleteOne(query);

            res.send(result);
        });

        // post new user
        app.post("/post/user", async (req, res) => {
            const newUser = req.body;
            const query = { email: newUser.email };
            const existingUser = await userCollection.find(query).toArray();
            // console.log(existingUser.length)

            if (existingUser.length === 0) {
                const result = await userCollection.insertOne(newUser);
                res.send(result);
            }
            return res.send({ message: "User already exist" });
        });

        // get all users
        app.get("/get/users",verifyToken,verifyAdmin, async (req, res) => {
            const users = await userCollection.find().toArray();
            res.send(users);
        });

        // delet User
        app.delete("/user/:id",verifyToken, verifyAdmin, async (req, res) => {
            const id = req.params.id;
            const query = { _id: new ObjectId(id) };
            const result = await userCollection.deleteOne(query);
            res.send(result);
        });

        // update user to Admin

        app.patch("/user/admin/:id",verifyToken,verifyAdmin, async (req, res) => {
            const id = req.params.id;
            const updateRole = req.body.updateRole;
            console.log(updateRole);
            const filter = { _id: new ObjectId(id) };

            const updateDoc = {
                $set: {
                    role: updateRole,
                },
            };
            const result = await userCollection.updateOne(filter, updateDoc);

            res.send(result);
        });

        // Check admin by email
        app.get("/user/admin/:email", verifyToken, async (req, res) => {
            const email = req.params.email;
            if (email !== req.decoded.email) {
                return res.status(403).send({ message: "forbidden access" });
            }
            const query = { email: email };
            const user = await userCollection.findOne(query);

            let admin = false;
            if (user) {
                admin = user?.role === "admin";
            }

            console.log(admin);
            res.send(admin);
        });

        await client.db("admin").command({ ping: 1 });
        console.log(
            "Pinged your deployment. You successfully connected to MongoDB!"
        );
    } finally {
        // Ensures that the client will close when you finish/error
        // await client.close();
    }
}
run().catch(console.dir);

app.listen(port, () => {
    console.log(`Example app listening on port ${port}`);
});
