let togglePassword;
let passwordField;
let submissionIdField;
let passhraseOutputField;
let sendErrorField;
let getErrorField;
let sendSuccessContainer;
let sendErrorContainer;
let getSuccessContainer;
let getErrorContainer;
let submissionIdInput;
let passphraseInput;
let passwordOutput;
let decrytedSecret;
let lastSubmissionId;
let decryptionError;
let lastResponse;

window.post = function(url, data) {
  return fetch(url, {method: "POST", headers: {'Content-Type': 'application/json'}, body: JSON.stringify(data)});
}

window.onload = () => {
  togglePassword = document.querySelector("#togglePassword");
  togglePasswordIcon = document.querySelector("#togglePasswordIcon");
  passwordField = document.querySelector("#passField");
  submissionIdField = document.querySelector("#submission-id")
  passhraseOutputField = document.querySelector("#passphrase-output")
  sendErrorField = document.querySelector("#send-error-field")
  getErrorField = document.querySelector("#get-error-field")
  sendSuccessContainer = document.querySelector("#send-success-container")
  sendErrorContainer = document.querySelector("#send-error-container")
  getSuccessContainer = document.querySelector("#get-success-container")
  getErrorContainer = document.querySelector("#get-error-container")
  submissionIdInput = document.querySelector("#submission-id-input")
  passphraseInput = document.querySelector("#passphrase")
  passwordOutput = document.querySelector("#password-output")

  togglePassword.addEventListener("click", function () {
    // toggle the type attribute
    const type = passwordField.getAttribute("type") === "password" ? "text" : "password";
    passwordField.setAttribute("type", type);
    // toggle the eye icon
    togglePasswordIcon.classList.toggle('fa-eye');
    togglePasswordIcon.classList.toggle('fa-eye-slash');
  });
}

window.getPass = async function getPass() {
  const id = submissionIdInput.value;
  const passphrase = passphraseInput.value;
  decrytedSecret = null;
  if (!id?.length || !passphrase?.length) return;
  getSuccessContainer.classList.add('d-none');
  getErrorContainer.classList.add('d-none');

  const tryDecrypt = async (res) => {
    try {
      decrytedSecret = await decrypt(
        base64ToAb(res.ciphertext),
        passphrase,
        base64ToAb(res.salt),
        base64ToAb(res.iv)
      );
      decryptionError = false;
      passwordOutput.textContent = decrytedSecret;
      getSuccessContainer.classList.remove('d-none');
    } catch (e) {
      decryptionError = true;
      getErrorField.textContent = 'Failed to decrypt secret. Please make sure your passphrase is correct.';
      getErrorContainer.classList.remove('d-none');
    }
  }

  // user entered wrong pass first time and changed it
  if (lastSubmissionId === id && decryptionError && !lastResponse?.error) {
    tryDecrypt(lastResponse);
  } else {
    window.post('http://anpass.de/api/get_pass', {id})
    .then(res => res.json())
    .then(res => {
      lastSubmissionId = id;
      lastResponse = res;
      if (!res?.error) {
        tryDecrypt(res);
      } else {
        getErrorField.textContent = res.error;
        getErrorContainer.classList.remove('d-none');
      }
    })
  }
}

//https://stackoverflow.com/questions/57602686/javascript-function-wont-trigger-when-called-in-html-file-during-parcel-build
window.send = async function send() { 
  let text = passwordField.value;
  if (!text?.length) return;
  sendSuccessContainer.classList.add('d-none');
  sendErrorContainer.classList.add('d-none');
  text = new TextEncoder().encode(text);
  const salt = window.crypto.getRandomValues(new Uint8Array(16));
  const iv = window.crypto.getRandomValues(new Uint8Array(12));
  const encPassword = getRandomString(8);
  const ciphertext = await encrypt(text, encPassword, salt, iv);
  const encrypted = {
    ciphertext: ab2base64(ciphertext), salt: ab2base64(salt), iv: ab2base64(iv)}
  window.post('http://anpass.de/api/save_pass', encrypted)
    .then(res => res.json())
    .then(res => {
      if (!res?.error) {
        submissionIdField.textContent = res.id;
        passhraseOutputField.textContent = encPassword;
        sendSuccessContainer.classList.remove('d-none');
      } else {
        sendErrorField.textContent = res.error;
        sendErrorContainer.classList.remove('d-none');
      }
    })
}

function copyPass() {
  copyTextToClipboard(decrytedSecret)
}

function getRandomString(length) {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789'
  const randomBytes = crypto.getRandomValues(new Uint8Array(length));
  const value = new Array(length);
  const len = Math.min(256, chars.length);
  const d = 256 / len;
  for (let i = 0; i < length; i++) {
    value[i] = chars[Math.floor(randomBytes[i] / d)];
  }
  return value.join('');
}


function getKeyMaterial(password) {
  let enc = new TextEncoder();
  return window.crypto.subtle.importKey(
    "raw",
    enc.encode(password),
    "PBKDF2",
    false,
    ["deriveBits", "deriveKey"]
  );
}

function getKey(keyMaterial, salt) {
  return window.crypto.subtle.deriveKey(
    {
      "name": "PBKDF2",
      salt: salt,
      "iterations": 100000,
      "hash": "SHA-256"
    },
    keyMaterial,
    { "name": "AES-GCM", "length": 256},
    true,
    [ "encrypt", "decrypt" ]
  );
}

async function encrypt(plaintext, password, salt, iv) {
  let keyMaterial = await getKeyMaterial(password);
  let key = await getKey(keyMaterial, salt)

  return await window.crypto.subtle.encrypt(
    {
      name: "AES-GCM",
      length: 256,
      iv: iv
    },
    key,
    plaintext
  );
}

async function decrypt(ciphertext, password, salt, iv) {
  let keyMaterial = await getKeyMaterial(password);
  let key = await getKey(keyMaterial, salt);
  let decrypted = await window.crypto.subtle.decrypt(
    {
      name: "AES-GCM",
      length: 256,
      iv: iv
    },
    key,
    ciphertext
  );
  return new TextDecoder().decode(decrypted)
}

function ab2base64(buffer) {
  var binary = '';
  var bytes = new Uint8Array( buffer );
  var len = bytes.byteLength;
  for (var i = 0; i < len; i++) {
      binary += String.fromCharCode( bytes[ i ] );
  }
  return window.btoa( binary );
}

function base64ToAb(base64) {
  var binary_string = window.atob(base64);
  var len = binary_string.length;
  var bytes = new Uint8Array(len);
  for (var i = 0; i < len; i++) {
      bytes[i] = binary_string.charCodeAt(i);
  }
  return bytes.buffer;
}

function fallbackCopyTextToClipboard(text) {
  var textArea = document.createElement("textarea");
  textArea.value = text;
  
  // Avoid scrolling to bottom
  textArea.style.top = "0";
  textArea.style.left = "0";
  textArea.style.position = "fixed";

  document.body.appendChild(textArea);
  textArea.focus();
  textArea.select();

  try {
    var successful = document.execCommand('copy');
    var msg = successful ? 'successful' : 'unsuccessful';
    console.log('Fallback: Copying text command was ' + msg);
  } catch (err) {
    console.error('Fallback: Oops, unable to copy', err);
  }

  document.body.removeChild(textArea);
}

function copyTextToClipboard(text) {
  if (!navigator.clipboard) {
    fallbackCopyTextToClipboard(text);
    return;
  }
  navigator.clipboard.writeText(text).then(function() {
    console.log('Async: Copying to clipboard was successful!');
  }, function(err) {
    console.error('Async: Could not copy text: ', err);
  });
}