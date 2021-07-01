const {
  transactionFactory,
  UserIdentity,
  config,
  tokensFactory
} = require('alastria-identity-lib')
const fs = require('fs')
const Web3 = require('web3')
const keythereum = require('keythereum')

const rawdata = fs.readFileSync('../configuration.json')
const configData = JSON.parse(rawdata)

//Nuestro keystore entityDigitelIssuer
const keyDataEntityIssuer = fs.readFileSync(
  '../keystores/issuerData.json'
)
const keystoreDataEntityIssuer = JSON.parse(keyDataEntityIssuer)
const keyDataAdmin = fs.readFileSync(
  '../keystores/entity1-a9728125c573924b2b1ad6a8a8cd9bf6858ced49.json'
)
const keystoreDataAdmin = JSON.parse(keyDataAdmin)

// Init your blockchain provider --- > Red T
const myBlockchainServiceIp = configData.nodeURL
const web3 = new Web3(new Web3.providers.HttpProvider(myBlockchainServiceIp))

console.log(
  '\n ------ Example of prepare Alastria ID, addKey and createAlastriaID necessary to have an Alastria ID ------ \n'
)
// Data

const adminKeyStore = keystoreDataAdmin

let adminPrivateKey
try {
  adminPrivateKey = keythereum.recover(
    configData.addressPassword,
    adminKeyStore
  )
} catch (error) {
  console.log('ERROR: ', error)
  process.exit(1)
}

const adminIdentity = new UserIdentity(
  web3,
  `0x${adminKeyStore.address}`,
  adminPrivateKey
)

const entityIssuerKeystore = keystoreDataEntityIssuer

let entityIssuerPrivateKey
try {
  entityIssuerPrivateKey = keythereum.recover(
    configData.addressIssuerPassword,
    entityIssuerKeystore
  )
} catch (error) {
  console.log('ERROR: ', error)
  process.exit(1)
}

const entityIssuerIdentity = new UserIdentity(
  web3,
  `0x${entityIssuerKeystore.address}`,
  entityIssuerPrivateKey
)
// End data

function preparedAlastriaId() {
  const preparedId = transactionFactory.identityManager.prepareAlastriaID(
    web3,
    entityIssuerKeystore.address
  )
  return preparedId
}

function createAlastriaId() {
  const txCreateAlastriaID = transactionFactory.identityManager.createAlastriaIdentity(
    web3,
    configData.entityIssuerPubk.substr(2)
  )
  return txCreateAlastriaID
}

console.log(
  '\n ------ A promise all where prepareAlastriaID and createAlsatriaID transactions are signed and sent ------ \n'
)
async function main() {
  const prepareResult = await preparedAlastriaId()
  const createResult = await createAlastriaId()

  const signedPreparedTransaction = await adminIdentity.getKnownTransaction(
    prepareResult
  )
  const signedCreateTransaction = await entityIssuerIdentity.getKnownTransaction(
    createResult
  )
  web3.eth
    .sendSignedTransaction(signedPreparedTransaction)
    .on('transactionHash', function (hash) {
      console.log('HASH: ', hash)
    })
    .on('receipt', function (receipt) {
      console.log('RECEIPT: ', receipt)
      web3.eth
        .sendSignedTransaction(signedCreateTransaction)
        .on('transactionHash', function (hash) {
          console.log('HASH: ', hash)
        })
        .on('receipt', function (receipt) {
          console.log('RECEIPT: ', receipt)
          web3.eth
            .call({
              to: config.alastriaIdentityManager,
              data: web3.eth.abi.encodeFunctionCall(
                config.contractsAbi.AlastriaIdentityManager.identityKeys,
                [entityIssuerKeystore.address]
              )
            })
            .then((AlastriaIdentity) => {
              console.log(
                `alastriaProxyAddress: 0x${AlastriaIdentity.slice(26)}`
              )
              configData.entityIssuer = `0x${AlastriaIdentity.slice(26)}`
              fs.writeFileSync(
                '../configuration.json',
                JSON.stringify(configData)
              )
              const alastriaDID = tokensFactory.tokens.createDID(
                configData.network,
                AlastriaIdentity.slice(26),
                configData.networkId
              )
              configData.didEntityIssuer = alastriaDID
              fs.writeFileSync(
                '../configuration.json',
                JSON.stringify(configData)
              )
              console.log('the alastria DID is:', alastriaDID)
            })
        })

        .on('error', function (error) {
          console.error(error)
          process.exit(1)
        }) // If a out of gas error, the second parameter is the receipt.
    })

    .on('error', function (error) {
      console.error(error)
      process.exit(1)
    }) // If a out of gas error, the second parameter is the receipt.
}

main()
