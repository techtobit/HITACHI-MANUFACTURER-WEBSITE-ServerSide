const express = require('express');
const app = express()
const { MongoClient, ServerApiVersion, ObjectId } = require('mongodb');
require('dotenv').config()
const cors = require('cors');
let jwt = require('jsonwebtoken');
const res = require('express/lib/response');
const port = process.env.PORT || 5000;
const stripe = require('stripe')(process.env.STRIPE_SECRET_KEY)


//Middleware
app.use(express.static("public"));
app.use(cors());
app.use(express.json());


// Middleware for Verify valid user and secure data
const verifyJW = (req, res, next) => {
  const authHeader = req.headers.authorization;
  // const axiosAuthHeader = req.config.headers.authorization;
  // console.log(axiosAuthHeader);
  if (!authHeader) {
    return res.status(401).send({ massage: 'Unauthorize Access' })
  }
  const token = authHeader.split(' ')[1];
  jwt.verify(token, process.env.WEB_TOKEN, function (err, decoded) {
    if (err) {
      return res.status(403).send({ massage: "Forbidden Access" })
    }
    req.decoded = decoded;
    next();
  })

}


const uri = `mongodb+srv://${process.env.USER_NAME}:${process.env.USER_PASS}@cluster0.0izne.mongodb.net/?retryWrites=true&w=majority`;
const client = new MongoClient(uri, { useNewUrlParser: true, useUnifiedTopology: true, serverApi: ServerApiVersion.v1 });


async function run() {
  try {
    await client.connect();
    const productsCollection = client.db("database").collection("products");
    const addCartCollection = client.db("database").collection("addcart");
    const userCollection = client.db("database").collection("user");
    const userReviewCollection = client.db("database").collection("userReview");
    const userProfileCollection = client.db("database").collection("userProfile");
    const blogCollection = client.db("database").collection("blog");

    // ------------------------ Only Admin Role ------------------------------//
    //load user email  data 
    app.get('/user', verifyJW, async (req, res) => {
      const user = await userCollection.find({}).toArray();
      res.send(user)
    });

    //Check admin for show admin route
    app.get('/admin/:email', verifyJW, async (req, res) => {
      const email = req.params.email;
      const user = await userCollection.findOne({ email: email });
      const isAdmin = user.role === 'admin';
      res.send({ admin: isAdmin });
    })


    //get users info 
    app.get('/user/:email', verifyJW, async (req, res) => {
      const email = req.params.email;
      const decodedEmail = req.decoded.email;
      if (email === decodedEmail) {
        const query = { email: email };
        const user = await userCollection.findOne(query);
        return res.send(user)
      }
      else {
        return res.status(403).send({ massage: 'Forbidden Access' })
      }

    })


    //Make admin and update users info 
    app.put('/user/admin/:email', verifyJW, async (req, res) => {
      const email = req.params.email;
      const requester = req.decoded.email;
      const requesterAccount = await userCollection.findOne({ email: requester });
      if (requesterAccount.role === 'admin') {
        const filter = { email: email };
        const updateDoc = {
          $set: { role: "admin" },
        };
        const result = await userCollection.updateOne(filter, updateDoc);
        res.send(result)
      }
      else {
        return res.status(403).send({ massage: 'Forbidden' })
      }
    })


    // deleted admin 
    app.delete('/user/admin/:email', async (req, res) => {
      const email = req.params.email;
      const query = { email: email };
      console.log(query);
      const deleteAdmin = await userCollection.deleteOne(query);
      res.send(deleteAdmin);
    })

    // app.delete('/user/admin/:id', async (req, res) => {
    //  const ObjectId = req.params.id;
    //  console.log("id is", ObjectId);
    //  const query = { _id:ObjectId(id)};
    //  const deleteAdmin = await addCartCollection.deleteOne(query);
    //  res.send(deleteAdmin);
    // })


    // add  product review
    app.get('/userReview', async (req, res) => {
      const user = await userReviewCollection.find({}).toArray();

      res.send(user)
    })


    // user product add review
    app.post('/userReview', async (req, res) => {
      const review = req.body
      const user = await userReviewCollection.insertOne(review);

      res.send(user)
    })

    //user profile updateing
    app.post('/userProfile', async (req, res) => {
      const profile = req.body
      const data = await userProfileCollection.insertOne(profile);
      res.send(data)
    })

    // ------------------------ Valid User Role  ------------------------------//


    // update users info 
    app.put('/user/:email', async (req, res) => {
      const email = req.params.email;
      const user = req.body;
      const filter = { email: email };
      const options = { upsert: true };
      const updateDoc = {
        $set: user,
      };
      const result = await userCollection.updateOne(filter, updateDoc, options);
      const token = jwt.sign({ email: email }, process.env.WEB_TOKEN, { expiresIn: '1d' });
      console.log(token);
      res.send({ result, token })
    })
    // ------------------------ Valid or noValid User Role ------------------------------//
    //load all data in hooks for home
    app.get('/products', async (req, res) => {
      const products = await productsCollection.find({}).toArray();
      res.send(products)
    })

    app.get('/products/:id', async (req, res) => {
      const id = req.params.id;
      const product = await productsCollection.findOne({ _id: ObjectId(id) });
      res.send(product)
    })


    //post a product
    app.post('/products', async (req, res) => {
      const product = req.body;
      const result = await productsCollection.insertOne(product)
      res.send(result)
    })

    //blog

    app.get('/blog', async (req, res) => {
      const blog = await blogCollection.find({}).toArray();
      res.send(blog)
    })




    /*   app.put('/products/:id', async (req, res) => {
       const id = req.params.id;
       const product = req.body;
       const filter = { id: review };
       console.log(filter);
       const options = { upsert: true };
       const updateDoc = {
        $set: product,
       }
       const addReview = await productsCollection.updateOne(filter, updateDoc, options);
       log(addReview);
       res.send(addReview);
      }) */
    app.put('/products/:id', async (req, res) => {
      const product = req.body;
      console.log("body", product);
      const query = { products: product.review };
      console.log("query", query);
      const exists = await productsCollection.findOne(query);
      console.log("find", exists);
      if (exists) {
        return res.send({ success: false, review: exists })
      }
      const pReview = await productsCollection.insertOne(product);
      return res.send({ success: true, pReview })
    })


    // delete product
    app.delete('/products/:id', async (req, res) => {
      const product = req.params.id;
      const query = { _id: ObjectId(product) };
      const deleteProduct = await productsCollection.deleteOne(query);
      res.send(deleteProduct);
    })








    // stripe 
    app.post('/create-payment-intent', async (req, res) => {
      const { total: price } = req.body;
      // const amount = parseI nt(price) * 100;

      if (price) {
        const amount = parseInt(price) * 100;
        const paymentIntent = await stripe.paymentIntents.create({
          amount: amount,
          currency: "usd",
          payment_method_types: ['card']
        });
        res.send({
          clientSecret: paymentIntent.client_secret,
        });
      }
    })


    // ------------------------ Valid User Role ------------------------------//

    //GET  add cart 
    app.get('/mycart', async (req, res) => {
      const orders = await addCartCollection.find({}).toArray();
      res.send(orders)
    })
    //GET  added cart for billing address cart 
    app.get('/mycart/:id', async (req, res) => {
      const id = req.params.id;
      const query = { _id: ObjectId(id), position: "unpaid" }
      const addedCart = await addCartCollection.findOne(query);
      res.send(addedCart)
    })

    // save added cart products 
    app.post('/mycart', async (req, res) => {
      const cart = req.body
      const query = { name: cart.name, price: cart.price }
      const exist = await addCartCollection.findOne(query)
      if (exist) {
        return res.send({ success: false, cart: exist })

      }
      const addCart = await addCartCollection.insertOne(cart);
      return res.send({ success: true, addCart });
    })


    // add review to shipped product
    app.get('/addReview', async (req, res) => {

      const query = { position: "shipped" }
      const review = await addCartCollection.find(query).toArray();
      res.send(review);
    });



    //delete add cart
    app.delete('/mycart/:id', async (req, res) => {
      const cart = req.params.id;
      const query = { _id: ObjectId(cart) };
      const deleteCart = await addCartCollection.deleteOne(query);
      res.send(deleteCart);
    })



    //STRIPE 





  } catch (error) {

  }
}

//calling async function
run().catch(console.dir)

app.get('/', (req, res) => {
  res.send('Site is Runinng');
})

app.listen(port, () => {
  console.log(`Site is run from port ${port}`)
})