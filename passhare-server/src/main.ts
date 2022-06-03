import express from 'express';
import cors from 'cors';
import * as path from 'path';

const app = express()
app.use(cors())
app.use('/api', express.json());
app.use('/', express.static(path.join(__dirname, 'public')));

const APP_PORT = 3000
const MAX_STORGE_SIZE = 5000; // max 47 MiB RAM Usage
const MAX_PASS_SIZE = 5000; // 2 bytes UTF-16 * 5000
const TTL = 90000; // 90 seconds before the password gets deleted

const passwords = new Map<number, {ciphertext: string, iv: string, salt: string, creationDate: number}>();

app.post('/api/save_pass', (req, res) => {
  try {
    if (passwords.size >= MAX_STORGE_SIZE) throw "memory full"
    if (!req?.body?.ciphertext?.length) throw "no password specified"
    if (!req?.body?.iv?.length) throw "no IV specified"
    if (!req?.body?.salt?.length) throw "no salt specified"
    if ((req.body.ciphertext as string).length > MAX_PASS_SIZE) throw "password too long"
    let i = 0;
    for (; i<MAX_STORGE_SIZE; i++)
      if (!passwords.has(i)) {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const obj: any = { creationDate: + new Date()};
        // avoid insecure desirialization
        obj.ciphertext = req.body.ciphertext;
        obj.iv = req.body.iv;
        obj.salt = req.body.salt;
        passwords.set(i, obj);

        setTimeout(() =>{
          if (passwords.get(i)?.ciphertext === req.body.ciphertext)
            passwords.delete(i);
        }, TTL);

        res.send({id: i})
        res.end();
        return
      }
    throw "couldn't save password";
  } catch (e) {
    res.status(500);
    res.send({error: e});
    res.end();
  }
});

app.post('/api/get_pass', (req, res) => {
  try {
    const id = parseInt(req.body?.id, 10);
    if (!passwords.has(id)) throw "id doesn't exist"
    res.send(passwords.get(id))
    passwords.delete(id);
    res.end();
  } catch (e) {
    res.status(500);
    res.send({error: e});
    res.end();
  }
})

app.listen(APP_PORT, () => {
  console.log(`Server listening on http://localhost:${APP_PORT}`)
})