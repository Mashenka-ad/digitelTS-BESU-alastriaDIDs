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

// Init your blockchain provider
const myBlockchainServiceIp = configData.nodeURL
const web3 = new Web3(new Web3.providers.HttpProvider(myBlockchainServiceIp))

console.log(
  '\n ------ Example of creating an Alastria ID for a Subject with Entity1 ------ \n'
)

// We have Entity1 which is an entity with both roles: Issuer (required) and Service Provider (not required).
// You get its private key and instantiate its UserIdentity
const keyDataEntityIssuer = fs.readFileSync(
  '../keystores/issuerData.json'
)
const entityIssuerKeyStore = JSON.parse(keyDataEntityIssuer)
let entityIssuerPrivateKey
try {
  entityIssuerPrivateKey = keythereum.recover(
    configData.addressIssuerPassword,
    entityIssuerKeyStore
  )
} catch (error) {
  console.log('ERROR: ', error)
  process.exit(1)
}
const entityIssuerIdentity = new UserIdentity(
  web3,
  `0x${entityIssuerKeyStore.address}`,
  entityIssuerPrivateKey
)

// We have Subject1 which is a person with an identity wallet. You get its private key and instantiate its UserIdentity
// This step should be done in the private Wallet.
const keyDataSubject1 = fs.readFileSync(
  '../keystores/holderData.json'
)
const subjectHolderKeystore = JSON.parse(keyDataSubject1)
let subjectHolderPrivateKey
try {
  subjectHolderPrivateKey = keythereum.recover(
    configData.addressHolderPassword,
    subjectHolderKeystore
  )
} catch (error) {
  console.log('ERROR: ', error)
  process.exit(1)
}
const subjectHolderIdentity = new UserIdentity(
  web3,
  `0x${subjectHolderKeystore.address}`,
  subjectHolderPrivateKey
)

function prepareAlastriaId() {
  const preparedId = transactionFactory.identityManager.prepareAlastriaID(
    web3,
    subjectHolderKeystore.address
  )
  return preparedId
}

function createAlastriaId() {
  const txCreateAlastriaID = transactionFactory.identityManager.createAlastriaIdentity(
    web3,
    configData.subjectHolderPubk.substr(2)
  )
  return txCreateAlastriaID
}

console.log(
  '\n ------  A promise all where prepareAlastriaID and createAlsatriaID transactions are signed and sent ------ \n'
)
async function main() {
  // At the beggining, the Entity1 should create an AT, sign it and send it to the wallet
  const at = tokensFactory.tokens.createAlastriaToken(
    configData.didEntityIssuer,
    configData.providerURL,
    configData.callbackURL,
    configData.networkId,
    configData.tokenExpTime,
    configData.kidCredential,
    configData.entityIssuerPubk,
    configData.tokenActivationDate,
    configData.jsonTokenId
  )
  const signedAT = tokensFactory.tokens.signJWT(at, entityIssuerPrivateKey)
  console.log('\tsignedAT: \n', signedAT)

  // The subject, from the wallet, should build the tx createAlastriaId and sign it
  const createResult = await createAlastriaId()
  const signedCreateTransaction = await subjectHolderIdentity.getKnownTransaction(
    createResult
  )

  // Then, the subject, also from the wallet should build an AIC wich contains the signed AT, the signedTx and the Subject Public Key
  const subjectSignedAT = tokensFactory.tokens.signJWT(
    signedAT,
    subjectHolderPrivateKey
  )
  const aic = tokensFactory.tokens.createAIC(
    [],
    [],
    signedCreateTransaction,
    subjectSignedAT,
    configData.subjectHolderPubk
  )
  const signedAIC = tokensFactory.tokens.signJWT(aic, subjectHolderPrivateKey)
  console.log('\tsignedAIC: \n', signedAIC)

  // Then, Entity1 receive the AIC. It should decode it and verify the signature with the public key.
  // It can extract from the AIC all the necessary data for the next steps:
  // wallet address (from public key ir signst tx), subject public key, the tx which is signed by the subject and the signed AT

  // Below, it should build the tx prepareAlastriaId and sign it
  const prepareResult = await prepareAlastriaId()
  const signedPreparedTransaction = await entityIssuerIdentity.getKnownTransaction(
    prepareResult
  )

  // At the end, Entity1 should send both tx (prepareAlastriaId and createAlastriaID, in that order) to the blockchain as it follows:
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
                [subjectHolderKeystore.address]
              )
            })
            .then((AlastriaIdentity) => {
              console.log(
                `alastriaProxyAddress: 0x${AlastriaIdentity.slice(26)}`
              )
              configData.subjectHolder = `0x${AlastriaIdentity.slice(26)}`
              fs.writeFileSync(
                '../configuration.json',
                JSON.stringify(configData, null, 4)
              )
              const alastriaDID = tokensFactory.tokens.createDID(
                configData.network,
                AlastriaIdentity.slice(26),
                configData.networkId
              )
              configData.didSubjectHolder = alastriaDID
              fs.writeFileSync(
                '../configuration.json',
                JSON.stringify(configData, null, 4)
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
