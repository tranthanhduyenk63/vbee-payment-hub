/* eslint-disable */
const express = require('express')
const app = express()
const port = 3000

app.post('/', (req, res) => {
	console.log(req);
  console.log(JSON.stringify(req.headers))
  res.send('Hello World!')
})

app.listen(port, () => {
  console.log(`Example app listening on port ${port}`)
})