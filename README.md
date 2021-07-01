# digitelTS- 

Issuer, Provider and Holder scripts to create, delete or update them on T network.
To execute them is necessary a *configuration.json* file with the keystore passwords. 
Similar keystores can be generated for testing purposes using a BIP-39 mnemonic as follows:
```
const keythereum = require('keythereum')
const ethers = require('ethers');
const Web3 = require('web3');

  mnemonic= 'your pretty handsome beautiful cheerful cool fantastic awesome amazing shiny spectacular wonderful marvelous gorgeous mnemonic'
  seed= ethers.HDNode.mnemonicToSeed(mnemonic)
  privateKeyEntity =  ethers.Wallet.fromMnemonic(mnemonic).privateKey;
  publicKeyEntity = ethers.utils.computePublicKey(ethers.Wallet.fromMnemonic(mnemonic).privateKey);
  compressedPublicKeyEntity = ethers.utils.computePublicKey(ethers.Wallet.fromMnemonic(mnemonic).privateKey,true);
  addressEntity = ethers.Wallet.fromMnemonic(mnemonic).address;

var web3 = new Web3(Web3.givenProvider || 'Your blockchain provider');
var privateKey = privateKeyEntity
var password = 'Your password'
var JsonWallet = web3.eth.accounts.encrypt(privateKey, password);
var entityjson = JSON.stringify(JsonWallet)
var fs = require('fs')
fs.writeFile('entityData.json', entityjson, function(err, result){
  if(err) console.log('Error', err);
});

try {
    entityPrivateKey = keythereum.recover(
      password,
      JsonWallet
    )
  } catch (error) {
    console.log('ERROR: ', error)
    process.exit(1)
  }
  console.log(entityPrivateKey)


```
