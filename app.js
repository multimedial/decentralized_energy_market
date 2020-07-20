////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
// Decentralized EnergyMarket
// C.Leske
// v1.0 19th may 2020
// info@multimedial.de
////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
function slurp (file) {
    return JSON.parse(fs.readFileSync(file, 'utf8'))
}
const fs = require('fs')
const web3 = require('web3')
const burrow = require('@monax/burrow')
const express = require('express')
const bodyParser = require('body-parser')
const sqlite3 = require('sqlite3')
const Step = require("step")
const chainURL = '192.168.178.10:10997'
const abiFile_consumer = 'bin/Consumer.bin'
const abiFile_levelnode = 'bin/LevellingNode.bin'
const deployFile = 'deploy.output.json'
const accountFile = 'account.json'
const pathToDB = './database/Simulation.db3'
const applicationPort = 3000
const normingFactor = 1000
// we need this adjustmentfactor in order to get rid of comma values
// prices in Euro are being transformed in order to get rid of the fractional part
const adjustmentFactorEnergyPrices = 10000000

let account = slurp(accountFile)
let chain = burrow.createInstance(chainURL, account.Address,{objectReturn: true})
let abi_consumer = slurp(abiFile_consumer).Abi
let abi_levelnode = slurp(abiFile_levelnode).Abi
let deploy = slurp(deployFile)
let contractAddressQuartier = deploy.consumer
let contractAddressLevelnode = deploy.levelnode
let db = null;
let eeg = {};
const CONSUMER = chain.contracts.new(abi_consumer, null, contractAddressQuartier)
const LEVELLINGNODE = chain.contracts.new(abi_levelnode, null, contractAddressLevelnode)
////////////////////////////////////////////////////////////////////////////////////////////////
// DEBUG area
////////////////////////////////////////////////////////////////////////////////////////////////
/*
eeg['solarcells'] = slurp('eeg-solarcells.json')
eeg['windturbine'] = slurp('eeg-windturbine.json')

enames = ['solarcells', 'windturbine']
for (nam in enames) {
    ename = enames[nam]
    eprice = _getBuyingPriceForEnergySource(ename, '10.01.2019 01:15')
    console.log(eprice)
    powers = [10, 11, 12, 13, 14, 15, 20, 25, 30, 35, 40, 50, 60, 70, 80, 90, 100]
    for (i in powers) {
        amount = powers[i]
        totalPrice = _computeTotalPriceForAmount(ename, amount, eprice)
        console.log("For " + amount + "kWh: " + totalPrice.toFixed(2))
    }
}

process.exit(0)
*/
////////////////////////////////////////////////////////////////////////////////////////////////
// callback function for events emitted by the smart contracts in blockchain
////////////////////////////////////////////////////////////////////////////////////////////////
function cb(err, data, callback) {
    if(data) console.log("EVENT: ", data['event'], data['args']);
}

CONSUMER.logMsg(cb);
LEVELLINGNODE.logMsg(cb);
LEVELLINGNODE.logMsg2(cb);
LEVELLINGNODE.TransactionSuccess(cb);
LEVELLINGNODE.hint(cb)
LEVELLINGNODE.getAPrice(cb);
LEVELLINGNODE.setAPrice(cb);
LEVELLINGNODE.setABuyingPrice(cb);
LEVELLINGNODE.getABuyingPrice(cb);
////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
const app = express()
app.use(bodyParser.json())
app.use(express.static('public'))
app.use(bodyParser.urlencoded({ extended: true }))
app.set('view engine', 'ejs')
////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
// Some helpers for parsing/validating input
////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
let asInteger = value => new Promise((resolve, reject) =>
  (i => isNaN(i) ? reject(`${value} is ${typeof value} not integer`) : resolve(i))(parseInt(value)))
////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
let param = (obj, prop) => new Promise((resolve, reject) =>
  prop in obj ? resolve(obj[prop]) : reject(`expected key '${prop}' in ${JSON.stringify(obj)}`))
////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
let handlerError = err => { console.log(err); return err.toString() }
////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
var data = {'energysources':[], 'buyingPrice': null, 'sellingPrice': null, 'error':null, 'transactionFailed': 0}
const openDB = function () {
    // open an sqlite3 database
    db = new sqlite3.Database(pathToDB, (err) => {
        if (err) { console.error(err.message); }
        console.log('Connected to ', pathToDB);
    });
}
const queryDB = function (key, tmp, cb) {
    let sql = "SELECT * from " + key + " order by date(Datum)"
    db.each( sql,
        (err, row) => tmp[row['Datum']] = {'produced': row['Erzeugung(MWh)'],
            'price': row['EPEXSPOT-Preis(€/MWh)']},
        () => cb(tmp, key) )
}
const closeDB = function () {
    db.close((err) => {
        if (err) { console.error(err.message); return;}
        console.log('Closed database connection.');
    });
}
const errorHandler = function(err, res) {
    nullValues['error'] = handlerError(err)
    res.send(nullValues)
}
////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
const defaultHabitatConfig = {
    'nameofhabitat': "Quartier",
    'surface_sqm': 5000,
    'consumption_per_sqm': 1,
    'nbr_persons': 20,
    'consumption_per_person': 1500,
    'buffer_size': 100,
    'energysources': [{'name': 'solarcells', 'power': 10}, {'name':'windturbine', 'power':10}]
}
const setHabitatConfig = function (obj,callback ) {

    CONSUMER.setQuartierConfig(
        obj['nameofhabitat']||"Quartier",
        obj['surface_sqm']||10000,
        obj['consumption_per_sqm']||1,
        obj['nbr_persons']||20,
        obj['consumption_per_person']||800,
        obj['buffer_size']||10).then(
        () => {

            console.log("sucessfully set quartier params")

            let esources = obj['energysources']

            for (i in esources) {

                let esrc = esources[i]
                let esourcename = esrc['name']
                let esourcepower = esrc['power']
                CONSUMER.addEnergySource(esourcename, esourcepower).then(ok => {
                    if (ok) {
                        eeg[esourcename] = slurp("eeg-" + esourcename + '.json')
                        console.log("Added energy source + eeg prices " + esourcename + " successfully.")
                    }
                }).then(callback())
            }
        }

    )
}
//////////////////////////////////////////////////////////////////////////////////////////////////////////////
// init
//////////////////////////////////////////////////////////////////////////////////////////////////////////////
process.on('exit', closeDB);
openDB()
console.log("Simulation database ready.")
clearEnergySources()
console.log("Cleared energysources.")
setHabitatConfig(defaultHabitatConfig, function(err,data) { getEnergySources(getQuartierConfig); })
console.log("Set default habitat config.")
////////////////////////////////////////////////////////////////////////////////////////////////
////////////////////////////////////////////////////////////////////////////////////////////////
////////////////////////////////////////////////////////////////////////////////////////////////
const getQuartierConfig = function() {
    return CONSUMER.getQuartierConfig().then( r => { console.log(r.values); data = {...data, ...r.values }; return data;})
}

const getEnergySources = function(cb) {
    CONSUMER.getNbrOfEnergySources()
        .then(src => {
            data['energysources']=[]
            for (i=0;i<src.values.nbrofsources;i++) {
                CONSUMER.getEnergySource(i).then(val => { data['energysources'].push(val.values) })
            }
        }).then(() => { if(cb) cb()} )
}

//////////////////////////////////////////////////////////////////////////////////////////////////////////////
// main index page with all infos
//////////////////////////////////////////////////////////////////////////////////////////////////////////////
app.get('/', (req, res) => {
    getQuartierConfig().then(data => getEnergySources(function(){res.render('index', data)}))
});

app.get('/getQuartierConfig', (req, res) => {
    CONSUMER.getQuartierConfig().then( r => { data = {...data, ...r.values }; res.send(data); })
})

app.get('/getEnergyprice', function(req, res){

    if (req.query['timestamp']) {
        let timestamp = req.query['timestamp']
        let sql = "SELECT * from Strompreise where Datum=?"
        db.get( sql, [timestamp], (err, row) => {
            if(err) {
                console.log(err.message)
                res.send(err.message)
                return
            }
            // everything ok, we got a price and a timestamp, store price in blockchain
            LEVELLINGNODE.setPriceForSingleWatt(timestamp, row['Preis(Euro/kWh)'] * (adjustmentFactorEnergyPrices/normingFactor) )
                .then( () => { row['adjustmentFactor'] = adjustmentFactorEnergyPrices; res.send(row)})
        })
    }
})



function _getBuyingPriceForEnergySource(energysource, timestamp) {
    ////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
    // retrieves the tariffs to be paid for a specific energysource (EEG-Vergütung)
    ////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
    let datekey = timestamp.split(' ')[0]
    datekey = datekey.split('.')
    datekey.shift()
    datekey.unshift("01")
    datekey = datekey.join('.')
    console.log("Energysource: " + energysource)
    console.log("Datekey: " + datekey)
    let eegPrices = eeg[energysource][datekey]
    console.log("EEG price(s) for energysource " + energysource + ": " + JSON.stringify(eegPrices))
    return eegPrices
}

function _computeTotalPriceForAmount(energysource, amount, eegPrices) {
    ////////////////////////////////////////////////////////////////
    // computes the total amount to be paid for a given energysource
    // and a given amount
    ////////////////////////////////////////////////////////////////

    let keys = []
    try {
        keys = Object.keys(eegPrices)
    } catch {}

    if (keys.length==0) {
        // no keys in it? then we got a flat price!
        return eegPrices
    }

    ////////////////////////////////////////////////////////////////
    // still here? then there are multiple keys in it
    // retrieve the applicable keys for the price computation
    // derived from the power definition of the energysource
    ////////////////////////////////////////////////////////////////
    let prices = {}
    for(i in keys) {
        key=parseInt(keys[i])
        if(amount=>key) {
            prices[key] = eegPrices[''+key]
        }
    }


    ////////////////////////////////////////////////////////////////
    // sum up total price for kWh for given energysource
    // by decomposing the amount into clusters
    ////////////////////////////////////////////////////////////////
    let totalPrice = 0
    let _power = amount
    let priceKeys = Object.keys(prices)
    for (i in priceKeys) {

        priceKey = priceKeys[i]
        powerslice = parseInt(priceKey)
        powersliceprice = prices[priceKey]

        if ((_power - powerslice) >= 0) {
            totalPrice += powerslice * powersliceprice
            _power -= powerslice
        } else {
            totalPrice += _power * powersliceprice
            break
        }

    }

    return totalPrice

}




app.get('/getBuyingEnergyprice', function(req, res){

    if (req.query['timestamp']) {

        let timestamp =req.query['timestamp']
        let energysource = req.query['energysource']
        let amount = req.query['amount']

        console.log(energysource,timestamp,amount)

        prices = _getBuyingPriceForEnergySource(energysource, timestamp)
        console.log("Buying prices for " + energysource + " on " + timestamp + ": " + JSON.stringify(prices))
        let divamount = (amount!=0 && amount!=undefined)?amount:1;
        console.log("divamount: " + divamount)
        let unitPrice = _computeTotalPriceForAmount(energysource, amount, prices)
        console.log("Total unit price: " + unitPrice)
        res.send({'energysource': energysource, 'unitprice': unitPrice, 'prices': prices})
    }
})

app.get('/setLumpEnergyBuyingPrice', function (req, res){
    if (req.query['timestamp']) {
        let timestamp = req.query['timestamp']
        let lumpUnitPrice = Math.floor(parseFloat(req.query['lumpunitprice']))
        console.log("Setting lump unit price for 1 Wh at " + timestamp + " to " + lumpUnitPrice)
        LEVELLINGNODE.setBuyingPrice(timestamp, lumpUnitPrice).then( response => res.send(response))
    }
})


app.post('/setQuartierConfig', function (req, res) {

    p = ['nameofhabitat', 'surface_sqm', 'consumption_per_sqm', 'nbr_persons', 'consumption_per_person', 'max_buffer_size']

    for (i in p) {
        if (!p[i] in req.body) {
            console.log("Parameter missing:" + p[i]);
            p[i] = 0;
        }
    }

    setHabitatConfig(req.body, function(results) {
        response = {}
        for (i in p) {
            try {
                response[p[i]] = results.values[p[i]]
            } catch {
                console.log(results.values);
                console.log("Missing property: " + p[i]);
            }

        }
        res.send(response)
    });

})

app.get('/getEnergySources', (req, res) => {

    CONSUMER.getEnergySources().then ( results => res.send(results) )

})

app.get('/clearEnergySources', (req, res) => {
    clearEnergySources().then(results => res.send(results.values.ok))
})

function clearEnergySources() {
    return CONSUMER.clearEnergySources()
}

app.get('/energysources', (req, res) => res.send(data['energysources']))

/*
app.get('/energysources', (req, res) => CONSUMER.getNbrOfEnergySources().then( src => {
list = []
nbr = src.values.nbrofsources;
for(i=0;i<nbr;i++) {
  CONSUMER.getEnergySource(i).then(src => {
      entry = {}
      entry['name'] = src.values.name
      entry['power'] = src.values.power
      list.push(entry)
  })
}
}).then(list => res.send(list)))
*/


app.get( '/balance_quartier', (req, res) => CONSUMER.getAccountBalance().then(balance => res.send(balance)) )

app.get( '/balance_remote', (req, res) => LEVELLINGNODE.getAccountBalance().then(balance => res.send(balance)) )

app.get("/loadUserProfile", (req,res) => {

    // load the selected user profile from the database
    profile = req.query['profile']
    console.log("Loading " + profile)
    let tmp = []
    let sql = "SELECT * from "+profile+" order by date(Zeit)"
    db.each( sql, (err, row) => tmp.push(row),
        () => {
        res.send(tmp);
        console.log("Done loading profile.")
        } )
})

app.get("/connect2DB", (req,res) => {

    getEnergySources()

    nbrKeys = Object.keys(data['energysources']).length

    if (nbrKeys == 0) {
        res.send({})
    }

    let results = {}

    for (i = 0; i < nbrKeys; i++) {
        key = data['energysources'][i]['name']
        queryDB(key, {}, function(data, key) {
            //console.log(data, key)
                results[key] = data;
                if (Object.keys(results).length==nbrKeys) {
                    // send it back
                    res.send(results)
                }
        })
    }
})

app.get("/results", (req,res) => res.send(results))

app.post('/setEnergyData', (req, res) => param(req.body, 'solarcells')
    .then(name => CONSUMER.setNameOfHabitat(web3.utils.asciiToHex(name)))
    .then(param(req.body, "surface_sqm")
        .then(surface => CONSUMER.setSurface(surface))
            .then(param(req.body, "consumption_per_sqm")
                .then(consumption_per_sqm => CONSUMER.setConsumptionpersqm(consumption_per_sqm))
                    .then(param(req.body, "nbr_persons")
                        .then(nbr_persons => CONSUMER.setNumberofpersons(nbr_persons))
                            .then(param(req.body, "consumption_per_person")
                                .then(consumption_per_person => CONSUMER.setPersonconsumption(consumption_per_person)))
                                    .then(a=> { fillData(); res.redirect('/')}))))
    .catch(err => res.send(handlerError(err)))
)

app.post('/balanceEnergyDifference', function(req, res) {

    let timestamp = req.body['timestamp']
    let differenceInWatt = parseFloat(req.body['differenceInWatt'])

    console.log("RAW values received: ", timestamp, differenceInWatt)

    nullValues = {'amountSold': 0, 'price': 0, 'totalAmount': 0, 'error:': null}

    console.log("Difference: " + differenceInWatt)

    // WE SELL ENERGY
    if (differenceInWatt > 0) {
        console.log("ASKING BLOCKCHAIN: Sell our self-produced energy: " + differenceInWatt + " Wh.")
        CONSUMER.sellEnergy(timestamp, differenceInWatt)
            .then(result => res.send(result.values))
            .catch(err => errorHandler(err, res))
    }

    // WE BUY ENERGY
    if (differenceInWatt < 0) {
        differenceInWatt = Math.abs(differenceInWatt)
        console.log("ASKING BLOCKCHAIN: Buy externally produced energy: " + differenceInWatt)
        CONSUMER.buyEnergy(timestamp, differenceInWatt)
            .then(result => { console.log(result.values); res.send(result.values)} )
            .catch(err => errorHandler(err, res))
    }

    if(differenceInWatt==0) {
        setTimeout(function(){res.send([0,0,0])}, 3000)
    }

})

//////////////////////////////////////////////////////////////////////////////////////////////////////////////
//////////////////////////////////////////////////////////////////////////////////////////////////////////////
//////////////////////////////////////////////////////////////////////////////////////////////////////////////
const url = `http://127.0.0.1:${applicationPort}`
app.listen(applicationPort, () => console.log(`Listening on ${url}...`))