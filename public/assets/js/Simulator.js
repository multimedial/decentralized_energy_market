const linearScale = 'linear'
const logarithmicScale = 'logarithmic'

const chart = new Chart($("#energyChart")[0].getContext('2d'), {
    type: 'line',
    data: [],
    options:{
        responsive: false,
        title: {
            display: true,
            text: 'Leistungswerte'
        },
        scales: {
                xAxes: [{
                display: true,
                scaleLabel: {
                    display: true,
                    labelString: "Zeitstempel"
                },
            }],
            yAxes: [{
                display: true,
                scaleLabel: {
                    display: true,
                    labelString: "Leistung/Verbrauch (kW/h)"
                },
                type: linearScale,
            }]
        }
    }
});
const diffchart = new Chart($("#differenceChart")[0].getContext('2d'), {
    type: 'bar',
    data: [],
    options:{
        responsive: false,
        title: {
            display: true,
            text: 'Differenz'
        },
        scales: {
            xAxes: [{
                display: true,
                scaleLabel: {
                    display: true,
                    labelString: "Zeitstempel"
                },
            }],
            yAxes: [{
                display: true,
                scaleLabel: {
                    display: true,
                    labelString: "kW/h"
                },
                type: linearScale,
                position:'left',
                id: 'y-axis-1',
                /*ticks: {
                    min: -20,
                    max: 20
                }*/
            }, {
                display: true,
                scaleLabel: {
                    display: true,
                    labelString: "GWei"
                },
                type: linearScale,
                position:'right',
                id: 'y-axis-2',
                /*ticks: {
                    min: -7500,
                    max: 7500
                }*/
            },]
        }
    }
})
const energychart = new Chart($("#energymix")[0].getContext('2d'), {
    type: 'doughnut',
    data: [],
    options: {
        responsive: true,
        legend: {
            position: 'top',
        },
        title: {
            display: false,
        },
        animation: {
            animateScale: true,
            animateRotate: true
        },
        circumference: Math.PI,
        rotation: -Math.PI
    }
})

////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
const bColor = [
    'rgba(255, 99, 132, 1)',
    'rgba(255, 206, 86, 1)',
    'rgba(54, 162, 235, 1)',
    'rgba(75, 192, 192, 1)',
    'rgba(153, 102, 255, 1)',
    'rgba(255, 159, 64, 1)'
]
const dateRules = {
    /*
    Datumsregeln für BDEW Lastprofi H0 (Haushalte)
    Winter      01.11. bis 20.03.
    Übergang    21.03. bis 14.05.
    Sommer      15.05. bis 14.09.
    Übergang    15.09. bis 31.10.
    */
    0: 'Winter',    // Januar
    1: 'Winter',    // Feb
    3: 'Uebergang', // Maerz
    5: 'Sommer',    // Juni
    6: 'Sommer',    // Juli
    7: 'Sommer',    // August
    9: 'Uebergang', // Oktober
    10: 'Winter',   // November
    11: 'Winter'    // Dezember
}
const weekdays = ['Werktag','Werktag','Werktag','Werktag','Werktag','Samstag','Sonntag']
const normingFactor = 1000 // factor for adjusting kilowatt in  calculations
const adjustmentFactorEnergyPrices = 10000000
////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
//from: https://stackoverflow.com/questions/8619879/javascript-calculate-the-day-of-the-year-1-366
////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
Date.prototype.isLeapYear = function() {
    var year = this.getFullYear();
    if((year & 3) != 0) return false;
    return ((year % 100) != 0 || (year % 400) == 0);
};
// get day of year for dynamic factor computation for loadlevels (Lastprofil)
Date.prototype.getDOY = function() {
    var dayCount = [0, 31, 59, 90, 120, 151, 181, 212, 243, 273, 304, 334];
    var mn = this.getMonth();
    var dn = this.getDate();
    var dayOfYear = dayCount[mn] + dn;
    if(mn > 1 && this.isLeapYear()) dayOfYear++;
    return dayOfYear;
};
////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
// loads user profile from database
////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
let use_buffer = false; // we want to use the optional buffer
let diff = 0;
let stats = {
    overallTotalProduction: 0,
    overallTotalConsumption: 0,
    overallTotalConsumptionNet: 0,
    overallTotalBought: 0,
    overallTotalSold: 0,
    overallRemoteBought: 0,
    overallRemoteSold: 0,
    overallRoundingError: 0,
    energysources: {},
    simulationStart: null,
    simulationEnd: null,
}
let type_energy = linearScale
let type_diff = linearScale
let displayItems = { '#simulatedDate': null,
    '#energy_produced':null,
    '#energy_consumed': null,
    '#difference_status': null,
    '#accumulated_rounding_error': 0,
    '#max_buffer_size': 0,
}
let simulationData = null
let simulationDate = null
let simulationSteps = 0
let iterationStep = 0
let sourcesOfEnergy = {}
let powerloadProfile = {}
let energysourceconfig = [].sort()
energysourceconfig.sort()
let balances = {}
let price = 0;
let epexprice = 0;
let keys;
let srcNumber = 0
let productionRatios = {}
let buffer_size = 0
let max_buffer_size = 0
let protocolWindow = null
let timeoutValue = 1000
////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
// SIMULATION PREPARATION FUNCTIONS
////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
function loadUserLoadProfile() {
    let loadprofile = $('#Lastprofil').val()
    $.ajax({
        type: "GET",
        url: "/loadUserProfile",
        data: { 'profile': loadprofile },
        dataType: "json",
        async: false,
        error: function(jqXHR, status, err) {
            alert(status, err)
            console.log(status, err)
        },
        success: function (data) {
            powerloadProfile = {}
            for (i in data) {
                let entry = data[i]
                powerloadProfile[entry['Zeit']] = entry
            }
            _showStatus("Lastprofil "+ loadprofile +" geladen.")
        }
    });
}

function loadSimulationData() {
    $.ajax({
        type: "GET",
        url: "/connect2DB",
        dataType: "json",
        async: false,
        error: function(jqXHR, status, err) {
            alert(status, err)
            console.log(status, err)
        },
        success: function (data) {
            simulationData = data;
            keys = Object.keys(simulationData)
            for (i in keys) {
                sourcesOfEnergy[keys[i]] = 0
            }

            if (Object.keys(sourcesOfEnergy)==0) {
                // no energy sources found?
                alert("Es wurden entweder keine Simulationsdaten oder keine Energiequellen gefunden!")
                $('#pleaseWaitDialog').modal('hide');
                simulationData = {}
                return
            }

            ////////////////////////////////////////////////////////////////////////////////////////////////////////////
            // from hereon, we assume the simulation data was loaded successfully
            ////////////////////////////////////////////////////////////////////////////////////////////////////////////
            simulationDates = Object.keys(simulationData[keys[0]])
            for (i in simulationDates) {
                let entry = '<option>'+simulationDates[i]+'</option>'
                $('#startDate').append(entry)
                $('#endDate').append(entry)
            }
            let start = simulationDates[0]
            stats['simulationStart'] = start
            let end = simulationDates[simulationDates.length-1]
            stats['simulationEnd'] = end
            $('#endDate').val(end)
            simulationDate = start
            simulationSteps = simulationDates.length
            ////////////////////////////////////////////////////////////////////////////////////////////////////////////
            // prepare the charts
            ////////////////////////////////////////////////////////////////////////////////////////////////////////////
            // init dataset for energy sources
            ////////////////////////////////////////////////////////////////////////////////////////////////////////////
            ii = 1
            datadummy = []
            labels = []
            let cols = []

            energychart.data.datasets.push( {data: [],backgroundColor: []} )
            // empty placeholder ring
            energychart.data.datasets.push( {data: []} )
            // overall global energy mix
            energychart.data.datasets.push( {data: [] })

            for(j in keys) {

                energysourcelabel = keys[j]

                let col = bColor[ii++]
                cols.push(col)

                chart.data.datasets.push({
                    data: [],
                    label: energysourcelabel,
                    backgroundColor: col,
                    stack: "renegerative Energie"
                })

                energychart.data.labels.push(energysourcelabel)
                energychart.data.datasets[0].data[j]=0
                energychart.data.datasets[energychart.data.datasets.length-1].data[j]=0

                stats.energysources[energysourcelabel] = 0

            }

            // add battery view
            label = "Puffer"
            cols.push(bColor[5])

            energychart.data.labels.push(label)
            energychart.data.datasets[0].data.push(0)
            energychart.data.datasets[energychart.data.datasets.length-1].data.push(0)

            // placeholder stats for external energy
            cols.push('rgba(200,0,0,128)')
            energychart.data.labels.push("Extern")
            energychart.data.datasets[0].data.push(0)
            energychart.data.datasets[energychart.data.datasets.length-1].data.push(0)

            // set the colors
            energychart.data.datasets[0].backgroundColor =
                energychart.data.datasets[energychart.data.datasets.length-1].backgroundColor = cols




            ////////////////////////////////////////////////////////////////////////////////////////////////////////////
            // init dataset for habitat
            ////////////////////////////////////////////////////////////////////////////////////////////////////////////
            chart.data.datasets.push( {data: [], label:"Verbrauch Quartier (kW/h)", backgroundColor: bColor[0], stack:"Quartier"} )

            ////////////////////////////////////////////////////////////////////////////////////////////////////////////
            // init datasets difference chart
            ////////////////////////////////////////////////////////////////////////////////////////////////////////////
            diffchart.data.datasets.push( {data: [], label:"neg. Differenz", backgroundColor: 'rgba(200,0,0,128)', yAxisID: 'y-axis-1'} )
            diffchart.data.datasets.push( {data: [], label:"pos. Differenz", backgroundColor: 'rgba(0,200,0,128)', yAxisID: 'y-axis-1'} )
            diffchart.data.datasets.push( {data: [], type: 'line', fill: false, label:"Strompreis in GWei/kWh",
                borderColor: 'rgba(0,0,0,255)', yAxisID: 'y-axis-2'} )
            diffchart.data.datasets.push( {data: [], type: 'line', fill: false, label:"EPEXSpot-Preis(Euro/MWh)",
                borderColor: 'rgba(255,128,0,64)', yAxisID: 'y-axis-2'} )

            chart.update()
            diffchart.update()
            energychart.update()

            _showStatus("Simulationswerte geladen - Energiequellen:  " + Object.keys(simulationData))
        }
    });
}

function loadPrices(timestamp, chain) {
    _showStatus("",true)
    _showStatus("", true)
    _showStatus("#################################################", true)
    _showStatus("", true)
    _showStatus("", true)
    _showStatus(("Simuliere " + timestamp).toUpperCase())
    _showStatus("", true)

    $.ajax({
        type: "GET",
        url: "/getEnergyprice",
        dataType: "json",
        data: {'timestamp': timestamp},
        async: true,
        success: values => {
            let key = 'Preis(Euro/kWh)'
            let origPrice = values[key]

            displayItems['#powerprice'] = origPrice

            price = ( origPrice * adjustmentFactorEnergyPrices )
            displayItems['#ethprice'] = price
            epexprice = values['EPEXSpot-Preis(Euro/MWh)']
            displayItems['#epexprice'] = epexprice
            // adjusting epex price to get rid of fractional part
            // for proper display in graph
            epexprice*=adjustmentFactorEnergyPrices
            _displayInfos(displayItems)
            _simulateTimeStep(timestamp)
        }
    });

};

function _simulateTimeStep(timestamp) {
    displayItems['#simulatedDate'] = displayItems['#simulatedDate2'] = timestamp
    //////////////////////////////////////////
    // deactivate button, show waiting dialog
    //////////////////////////////////////////
    $('#timeStepper').addClass('disabled')

    //////////////////////////////////////////
    // show some stats for the buffer
    //////////////////////////////////////////
    displayItems['#buffer_size'] = buffer_size.toFixed(2)

    ////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
    // now updating the consumption of the habitat + pushing to chart
    ////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
    let consumption = calculateConsumptionForTimestep(timestamp)
    chart.data.labels.push(timestamp)
    chart.data.datasets[chart.data.datasets.length-1].data.push( consumption )

    ////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
    // iterate over energy sources, and collect their production data
    ////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
    keys = Object.keys(sourcesOfEnergy)
    keys.sort()
    let totalproduction = 0
    ////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
    // iterate through energy sources to get produced power levels
    ////////////////////////////////////////////////////////////////////////////////////////////////////////////////////

    for(i in keys) {
        energysource = keys[i]
        ////////////////////////////////////////////////////////////////////////////////////////////////////////////////
        // get the simulation data
        ////////////////////////////////////////////////////////////////////////////////////////////////////////////////
        // notice:
        // Simulation data is stored in MW/h (MegaWatt per hour) for standardized energysources with 1000kW/h power,
        // we therefore need to adjust for kW/h first, and then multiply by the power dimension of the energysource
        ////////////////////////////////////////////////////////////////////////////////////////////////////////////////
        let maxPowerOfEnergySource = _findInList(energysource)['power']

        ////////////////////////////////////////////////////////////////////////////////////////////////////////////////
        // retrieve the amount of electricity produced according to simulation data
        ////////////////////////////////////////////////////////////////////////////////////////////////////////////////
        let producedEnergyLevel = simulationData[energysource][timestamp]['produced']

        ////////////////////////////////////////////////////////////////////////////////////////////////////////////////
        // first norm the produced energy level, then scale it up
        ////////////////////////////////////////////////////////////////////////////////////////////////////////////////
        producedPower = producedEnergyLevel*maxPowerOfEnergySource // incorrect scaling of powerlevel, see discussion
        ////////////////////////////////////////////////////////////////////////////////////////////////////////////////
        productionRatios[energysource] = producedPower
        ////////////////////////////////////////////////////////////////////////////////////////////////////
        // Now update charts:
        // push data into main chart
        ////////////////////////////////////////////////////////////////////////////////////////////////////
        chart.data.datasets[i].data.push(producedPower)
        chart.update()
        ////////////////////////////////////////////////////////////////////////////////////////////////////
        // update current energy mix chart
        ////////////////////////////////////////////////////////////////////////////////////////////////////
        energychart.data.datasets[0].data[i] = producedPower
        // compute overall energy mix
        totalproduction += producedPower;
        stats.energysources[energysource] += producedPower
        energychart.data.datasets[energychart.data.datasets.length-1].data[i] = stats.energysources[energysource]
        energychart.update()
    }


    let _labels = energychart.data.labels
    let _currentdata = energychart.data.datasets[0].data
    let _totaldata = energychart.data.datasets[2].data
    let energymix = {}

    let statLabel = "<tr><th>Quelle</th><th>Aktuell</th><th>Gesamt</th></tr>"

    for (i in _labels) {

        let label = _labels[i]
        let current = _currentdata[i]
        let total = _totaldata[i]

        statLabel+=
            "<tr>" +
            "<td class='table-sm'>" + label +"</td>" +
            "<td class='table-sm'>" + current.toFixed(2)+"</td>" +
            "<td class='table-sm'>" + total.toFixed(2)+"</td>" +
            "</tr>"
        energymix[label] = {'current': current, 'total': total}
    }
    stats['energymix'] = energymix

    $('#current_energymix').html( statLabel )
    _displayInfos()
    _showStatus("")
    _showStatus("AKTUELLE PRODUKTION", true)
    _dumpObject(productionRatios)

    // normalize ratios
    k = Object.keys(productionRatios)
    for (i in k) {
        productionRatios[k[i]] /= totalproduction
    }

    _showStatus("GESAMT PRODUKTION (kWh): " + totalproduction.toFixed(2), true)

    /*
        _showStatus("")
        _showStatus("Normalisiert", true)
        _dumpObject(productionRatios)
        */


    ////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
    // update diff chart
    ////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
    diff = totalproduction - consumption;
    displayItems['#difference_status'] = diff.toFixed(2)
    diff = _computeNetDifference()

    _showStatus("", true)
    _showStatus("GESAMT PRODUKTION\t " + totalproduction.toFixed(2) + " kWh", true)
    _showStatus("GESAMT VERBRAUCH\t" + -consumption.toFixed(2) + " kWh", true)
    if(use_buffer) {
        let buffer = stats['buffer_contribution']
        _showStatus("BEITRAG PUFFER\t\t " + buffer + " kWh", true)
    }
    _showStatus("-------------------------------", true)
    _showStatus("DIFFERENZ\t\t " + diff.toFixed(2) + " kWh", true)

    // show icon if self-sufficient or not
    $('#self-sufficient').prop( 'src', (diff>0)?"assets/img/emoji-sunglasses.svg":"assets/img/emoji-angry.svg" )

    ///////////////////////////////////////////////////////////
    // push the label onto the difference chart for display
    ///////////////////////////////////////////////////////////
    diffchart.data.labels.push(timestamp)

    whatToPush = (diff<0)?[diff,0]:[0,diff];

    diffchart.data.datasets[0].data.push(whatToPush[0])
    diffchart.data.datasets[1].data.push(whatToPush[1])

    ///////////////////////////////////////////////////////////
    // push the current energy price to graph
    ///////////////////////////////////////////////////////////
    diffchart.data.datasets[2].data.push(price)
    diffchart.data.datasets[3].data.push(epexprice)
    diffchart.update()

    ////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
    // update stats and display the infos
    ////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
    stats.overallTotalProduction += totalproduction
    displayItems['#energy_produced'] = totalproduction.toFixed(2)
    displayItems['#quartier_overall_production'] = (stats.overallTotalProduction*normingFactor).toFixed(2)

    stats.overallTotalConsumption += consumption
    displayItems['#energy_consumed'] = consumption.toFixed(2)
    displayItems['#quartier_overall_consumption'] = (stats.overallTotalConsumption*normingFactor).toFixed(2)

    stats.overallTotalConsumptionNet += diff
    stats.overallTotalDifference = diff*normingFactor
    displayItems['#quartier_overall_difference'] = stats.overallTotalDifference.toFixed(2)
    /////////////////////////////////////////////////////////////////////////////////////////
    // update energymix chart
    /////////////////////////////////////////////////////////////////////////////////////////
    // the last entry in the dataset is always the external energy
    /////////////////////////////////////////////////////////////////////////////////////////
    let lastindex = energychart.data.datasets[0].data.length-1
    energychart.data.datasets[0].data[lastindex] = (diff<0)?Math.abs(diff):0

    // for global chart
    let j = energychart.data.datasets.length-1
    energychart.data.datasets[j].data[lastindex] = Math.abs(stats.overallTotalConsumptionNet)
    ////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
    // update the charts
    ////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
    energychart.update()

    $('#levelEnergy').removeClass('disabled')

    showBuyingPrices()

}

function _dumpObject(obj) {
    k = Object.keys(obj)
    for(i in k) {
        let key = k[i]
        let val = obj[key]
        try{
            val = JSON.stringify(val)
            val = val.toFixed(2)
        }
        catch {}
        _showStatus(key +" = " + val ,true)
    }
}

function _computeNetDifference() {

    displayItems['#difference_net'] = displayItems['#difference_status']
    displayItems['#buffer_contribution'] = stats['buffer_contribution'] = 0

    let load = 0
    let depletion = 0
    ////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
    // do we want to use a battery?
    ////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
    // if so:
    // do we want to use it, even when the energy price is negative? We would "earn" money by "buying" energy
    ////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
    use_buffer = $('#use_buffer').prop('checked')
    if (use_buffer) {

        _showStatus("", true)
        _showStatus("PUFFERSPEICHER AKTIV", true)

        diff = parseFloat(displayItems['#difference_status'])

        ////////////////////////////////////////////////////////////////////////////////////////////////////////////////
        // the energy difference is negative, so we need to deplete the battery of energy
        ////////////////////////////////////////////////////////////////////////////////////////////////////////////////
        if (diff < 0) {
            depletion = (Math.abs(diff) >= buffer_size) ? buffer_size : Math.abs(diff) ;
            buffer_size -= depletion
            diff += depletion
            displayItems['#buffer_contribution'] = stats['buffer_contribution'] = depletion.toFixed(2)
            _displayInfos(displayItems)
            _showStatus("Pufferspeicher entlädt " + depletion + " kW/h.", true)
        }

        ////////////////////////////////////////////////////////////////////////////////////////////////////////////////
        // the energy difference is positive, so we may want to load the battery if empty
        ////////////////////////////////////////////////////////////////////////////////////////////////////////////////
        if (diff > 0) {

            // do we need to load the battery?
            if (buffer_size < max_buffer_size) {

                missing_energy = max_buffer_size - buffer_size

                if (missing_energy < diff) {
                    //////////////////////////////////////////////////
                    // plenty of energy, load battery to the fullest
                    //////////////////////////////////////////////////
                    load = missing_energy
                    buffer_size = max_buffer_size
                }

                if (missing_energy > diff) {
                    //////////////////////////////////////////////////
                    // only partially loading battery
                    //////////////////////////////////////////////////
                    load = diff
                    buffer_size += load
                }
            }

            // readjust energy difference
            diff -= load

            ////////////////////////////////////////////////////////////////////////////////////////////////////////////
            // display some info
            ////////////////////////////////////////////////////////////////////////////////////////////////////////////
            _showStatus("Pufferspeicher lädt: " + load + " kW/h.", true)
            displayItems['#buffer_contribution'] = stats['buffer_contribution'] = load.toFixed(2)
        }

        // show the adjusted net difference after buffer
        displayItems['#difference_net'] = diff.toFixed(2)
        displayItems['#buffer_size'] = stats['buffer_size'] = buffer_size.toFixed(2)
        stats['max_buffer_size'] = max_buffer_size

        _showStatus("Stand Pufferspeicher: " + buffer_size.toFixed(2) + " kW/h.",true)
        _showStatus("VERBLEIBENDE DIFFERENZ: " + diff.toFixed(2) + " kW/h", true)

    }

    ////////////////////////////////////////////////////////////////////////////////////////////////////////////////
    // update energymix chart
    ////////////////////////////////////////////////////////////////////////////////////////////////////////////////
    // ring with today's energy mix
    ////////////////////////////////////////////////////////////////////////////////////////////////////////////////
    // ring with global energy mix
    ////////////////////////////////////////////////////////////////////////////////////////////////////////////////
    let lastEntryDataGlobal = energychart.data.datasets.length-1
    let idxDiff = energysourceconfig.length

    energychart.data.datasets[0].data[idxDiff] = depletion
    energychart.data.datasets[lastEntryDataGlobal].data[idxDiff] += depletion

    _displayInfos(displayItems)

    // return adjusted difference
    return diff
}

function calculateConsumptionForTimestep(simulationDate) {

    if (simulationDate==undefined) return;

    let baseConsumption = _calculateBaseConsumption()
    let dynamicConsumption = _calculateDynamicConsumption(simulationDate)
    let totalConsumption = baseConsumption + dynamicConsumption

    stats['baseconsumption'] = baseConsumption.toFixed(2)
    stats['dynamicconsumption'] = dynamicConsumption.toFixed(2)
    stats['totalconsumption'] = totalConsumption.toFixed(2)

    _showStatus("AKTUELLER VERBRAUCH", true)
    _dumpObject({"Grundverbrauch": baseConsumption, "Dyn. Verbrauch": dynamicConsumption })
    _showStatus("GESAMT VERBRAUCH (kWh): " + stats['totalconsumption'], true)

    return  totalConsumption

}


let priceInfos = {'label': 'Strompreis:', 'price':0, 'diff': 0 }


function showBuyingPrices() {


    let sources = Object.keys(productionRatios)
    let diff = parseFloat($('#difference_net').text())
    let _diff = (diff < 0) ? sources.length : diff
    const totalAmountEnergyProduced = Object.values(productionRatios).reduce((pv, cv) => pv + cv, 0);

    $('#difference_status').text(diff)
    $('#listeegprices').empty()

    let unitPriceForEEGVerguetung_pauschal = 0
    for (i in sources) {

        energysource = sources[i]
        const ratio = productionRatios[energysource] / totalAmountEnergyProduced
        const amount = _diff * ratio
        $.ajax({
            type: "GET",
            url: "/getBuyingEnergyprice",
            data: {amount: amount, timestamp: simulationDate, energysource: energysource},
            dataType: "json",
            async: false,
            error: (jqXHR, status, err) => console.log(status, err),
            success: function (response) {

                let unitPrice = response['unitprice']
                unitPriceForEEGVerguetung_pauschal += unitPrice

                let unitPrices = response['prices']

                let display = unitPrices
                if (typeof unitPrices == 'object') {
                    // this is JSON data
                    display = ''
                    let k = Object.keys(unitPrices)
                    for (i in k) {
                        let val = parseInt(k[i])
                        display += "<=" + val + "kWh: " + unitPrices[k[i]] + "<br>"
                        if (val > Math.abs(_diff)) {
                            break
                        }
                    }

                }
                $('#listeegprices').append("<div class='col'><i>" + energysource + "</i></div>")
                $('#listeegprices').append("<div class='col text-nowrap text-right'>" + display + "</div>")
            }
        })
    }

    priceInfos['diff'] = diff * normingFactor

    // branch
    if (diff > 0) _handleSurplus(diff, unitPriceForEEGVerguetung_pauschal)
    if (diff <= 0) _handleNeed(diff)

}

function _handleSurplus(diff, unitPriceForEEGVerguetung_pauschal) {

        _showStatus("-------------------------------", true)
        _showStatus("STROMÜBERSCHUSS:\t " + diff*normingFactor + " Wh", true)
        if (unitPriceForEEGVerguetung_pauschal > 0) {
            // set EEG lump price
            const unitPriceForEEGVerguetung_pauschal_Watt = unitPriceForEEGVerguetung_pauschal/normingFactor
            $.ajax({
                type: "GET",
                url: "/setLumpEnergyBuyingPrice",
                data: {'timestamp': simulationDate, 'lumpunitprice': unitPriceForEEGVerguetung_pauschal_Watt *
                        adjustmentFactorEnergyPrices },
                dataType: "json",
                async: false,
                error: function (jqXHR, status, err) {
                    console.log(status, err)
                },

                success: function (response) {

                    let unitPriceForEEGVerguetung_pauschal_Watt = response.values['buyingPrice']
                    _showStatus("Pauschale EEG-Vergütung(€/kWh): " + unitPriceForEEGVerguetung_pauschal + " (" +
                        unitPriceForEEGVerguetung_pauschal*adjustmentFactorEnergyPrices + " Wei/kWh)", true)
                    _showStatus("In Wei/Wh: " + unitPriceForEEGVerguetung_pauschal_Watt, true)
                    let sources = Object.keys(productionRatios)
                    for (i in sources) {
                        let ratio = productionRatios[sources[i]]
                        let total = ratio * Math.abs(diff)
                        _showStatus(ratio + " * " + unitPriceForEEGVerguetung_pauschal +
                            "€ * " + diff + " = " + (total*unitPriceForEEGVerguetung_pauschal) + " €", true)
                    }
                    let total = unitPriceForEEGVerguetung_pauschal * diff
                    let totalInWei = (unitPriceForEEGVerguetung_pauschal_Watt) * diff * normingFactor
                    _showStatus("Gesamt: " + total + " € (" + totalInWei + " Wei)", true)
                    priceInfos['label'] = "EEG-Vergütung (Wh):"
                    priceInfos['price'] = unitPriceForEEGVerguetung_pauschal_Watt
                }
            })
        }


        displayItems['#eeg_price'] = unitPriceForEEGVerguetung_pauschal.toFixed(2)
        displayItems['#eeg_price_gwei'] = (unitPriceForEEGVerguetung_pauschal*adjustmentFactorEnergyPrices).toFixed(2)

        _displayInfos(displayItems)
        _proceedWithSimulation()
}


function _handleNeed(diff) {
        // we need to buy energy
        _showStatus("-------------------------------", true)
        _showStatus("STROMDEFIZIT:\t\t" + diff * normingFactor + " Wh", true)
        priceInfos['label'] = "Strompreis (Wh):"
        priceInfos['price'] = price / normingFactor
        _showStatus("Strompreis:\t\t " + price / normingFactor  + " Wei/Wh", true)
        _showStatus("Kosten:\t\t\t" + diff*price + " Wei", true)
        _proceedWithSimulation()
}

function _proceedWithSimulation() {
    $('#looping').prop('checked')?setTimeout(_startBalancing, timeoutValue):_cleanUp()
}

function _startBalancing() {

    let thePrice = priceInfos['price']
    let displayDiff = priceInfos['diff']
    let diff = parseFloat($('#difference_net').text())
    let label = priceInfos['label']
    let total = Math.floor(displayDiff * thePrice)

    let statusMsg = "<h4>Lastausgleich "+simulationDate+"</h4>"
    if (diff==0) {
        statusMsg += "Beitrag Pufferspeicher: "+displayItems['#buffer_contribution']+" kWh"
    }
    statusMsg+="<table class='table table-striped flex-lg-nowrap text-nowrap'>" +
        "<tr>" +
        "<td class='text-left text-nowrap'>Differenz (Wh):</td>" +
        "<td class='col text-right text-nowrap'>" + displayDiff + "</td>" +
        "<td>Wh</td>" +
        "</tr>" +
        "<tr>" +
        "<td class='text-left text-nowrap'>" + label + "</td>" +
        "<td class='col text-right text-nowrap'>" + thePrice + "</td>" +
        "<td>Wei</td>" +
        "</tr>" +
        "<hr>" +
        "<tr>" +
        "<td class='text-left text-nowrap'><b>GESAMT:</b></td>" +
        "<td class='col text-right text-nowrap'><b>" + total + "</b></td>" +
        "<td>Wei</td>" +
        "</tr>" +
        "</table>"
    statusMsg += "(Aufruf Smart Contract in der Blockchain)"
    $('#pleaseWaitDialog').modal()
    $('#simulationStatus').html(statusMsg)
    _showStatus("", true)
    _showStatus("-------------------------------", true)
    status = ("Aufruf Smart Contract für Lastausgleich\n").toUpperCase()
    status +="Differenz:\t\t" + displayDiff + " Wh\n"
    status += label + "\t" + thePrice + " Wei\n"
    status += "GESAMT:\t\t\t" + total + " Wei"
    _showStatus(status, true)
    _showStatus("-------------------------------", true)

    $('#levelEnergy').addClass("disabled")

    _balanceEnergy(diff, simulationDate)
}

function _balanceEnergy(diff, simulationDate) {

    // balance the energy difference
    $.ajax({
        type: "POST",
        url: "/balanceEnergyDifference",
        data: {differenceInWatt: diff*normingFactor, timestamp: simulationDate},
        dataType: "json",
        async: false,
        error: function(jqXHR, status, err) {
            console.log(status, err)
        },
        success: function(values) {

            console.log("Response: " + JSON.stringify(values), diff)
            err = values['error'] || values['errorMsg']

            if(err!='' && err!=undefined) {
                // something went wrong!
                alert(err, JSON.stringify(values))
                $('#looping').prop("checked", false)
                //return
            }

            try {
                delete (values['error'])
            } catch {}

            try {
                delete (values['errorMsg'])
            } catch {}

            for (k in values) {
                key = values[k]
                $('#'+key).val(values[key])
            }

            if ('amountBought' in values) {
                let amountBought = values['amountBought']
                stats.overallRemoteBought += amountBought
                stats.overallTotalSold += amountBought
                displayItems['#remote_sold'] = stats.overallRemoteBought.toFixed(2)
                displayItems['#quartier_bought'] = stats.overallTotalSold.toFixed(2)
                _showStatus("Ankauf von " + amountBought + "\n" + JSON.stringify(values))
            }

            if('amountSold' in values) {
                let amountSold = values['amountSold']
                stats.overallRemoteSold += amountSold
                stats.overallTotalBought += amountSold
                displayItems['#remote_bought'] = stats.overallRemoteSold.toFixed(2)
                displayItems['#quartier_sold'] = stats.overallTotalBought.toFixed(2)
            }

            // accumulate rounding errors
            stats.overallRoundingError += Math.abs(Math.abs(stats.overallTotalDifference) - Math.abs(stats.overallRemoteBought))
            displayItems['#quartier_rounding_losses'] = stats.overallRoundingError.toFixed(2)
            queryAccountBalances()
            _cleanUp()
            _showStatus("", true)
            _showStatus("Statistik:", true)
            _dumpObject(stats)
            iterate()
            if($('#looping').prop('checked')) simulate()

        }
    })

}



function iterate() {

    // nothing to simulate? Let's bail out then...
    if(simulationData == null || Object.keys(simulationData).length==0) return

    let simluationEnd = stats['simulationEnd']
    if (simulationDate == simluationEnd) {
        endSimulation("Ende des Simulationszeitraumes wurde erreicht: " + simluationEnd)
        return
    }

    ////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
    // get simulation date for given energysource by name at iterationstep
    ////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
    iterationStep++
    if (iterationStep==(simulationSteps-1)) {
        endSimulation("Ende der Simulation: " + simulationDate)
        return
    }
    simulationDate = Object.keys(simulationData[Object.keys(sourcesOfEnergy)[0]])[iterationStep]
    displayItems['#simulatedDate'] = displayItems['#simulatedDate2'] = simulationDate
    displayItems['#iteration'] = iterationStep
    _displayInfos(displayItems)

    return simulationDate

}

function endSimulation(reason) {
    alert(reason)
    $('#looping').prop('checked', false)
}



function simulate() {
    loadPrices( simulationDate, true)
}

function loop() {
    iterate()
    simulate()
}

////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
// private functions
////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
function _computeTotalPriceForAmount(energysource, amount) {
    ////////////////////////////////////////////////////////////////
    // computes the total amount to be paid for a given energysource
    // and a given amount
    ////////////////////////////////////////////////////////////////
    eegPrices = eeg[energysource]
    let keys = []
    try {
        keys = Object.keys(eegPrices)
    } catch {}

    if (keys.length==0) {
        // no keys in it? then we got a flat price!
        return amount * eegPrices
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
function _calculateDynamicConsumption(simulationDate) {
    consumptionFactor = _getConsumptionFactorFromLoadProfile(simulationDate)
    let per_personconsumption = parseInt($("#consumption_per_person").val(), 10);
    let numberofpersons = parseInt($("#nbr_persons").val(), 10);
    personconsumption = (per_personconsumption/normingFactor)
    // according to the rules of the BDEW SLPs, it is allowed to modulate the consumption with a factor
    return (personconsumption * consumptionFactor) * numberofpersons
}
function _calculateBaseConsumption() {
    ////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
    // calculation of base consumption of infrastructure
    ////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
    let surface = parseInt($("#surface_sqm").val(), 10);
    let baseconsumption = parseInt($("#consumption_per_sqm").val(), 10);
    let totalbaseconsumption = surface * (baseconsumption/simulationSteps)
    return totalbaseconsumption
}
function _computeDynamicFactor(simulationDate) {

    splittedDate = simulationDate.split(' ')[0].split('.')
    let t = new Date(splittedDate[2]+"-"+splittedDate[1]+"-"+splittedDate[0]).getDOY()

    // formula for dynamic factor of loadprofile H0
    const dynamisierungsfaktorLastprofil = -3.92*Math.pow(10, -10)*Math.pow(t,4) +
        3.2*Math.pow(10, -7)*Math.pow(t,3) -
        7.02*Math.pow(10,-5)*Math.pow(t,2) +
        2.1*Math.pow(10, -3)*t + 1.24

    return dynamisierungsfaktorLastprofil

}
function _getConsumptionFactorFromLoadProfile(simulationDate) {
    dynamicFactor = _computeDynamicFactor(simulationDate)
    // filter times available and pick production value
    theTime = simulationDate.split(' ')[1]
    consumptionFactor = 0
    // let's collect all matching keys of current user profile
    let profileKey = _buildProfileKey(simulationDate)
    Object.keys(powerloadProfile).filter(item => {
        if (('0'+item).slice(-5).startsWith(theTime)) {
            consumptionFactor += powerloadProfile[item][profileKey] * dynamicFactor }
    })
    // according to lastprofil description,the values are in WATT! Not Kw! Thus we need to convert to kW/h
    consumptionFactor=consumptionFactor/normingFactor

    return consumptionFactor

}
function _buildProfileKey(theDate) {

    var parts = theDate.match(/(\d+)/g);
    theDate = new Date(parts[2], parts[1]-1, parts[0]);

    let month = theDate.getMonth()  // note: month is 0-based (0=january)
    let day =  theDate.getDate()    // date of current day
    let weekday = theDate.getDay()  // zero based (0 = monday)

    let workdayKey = weekdays[weekday]
    let profileKey = ''

    // easy case for months 0,1,3,5,6,7,9,10,11
    try {
        profileKey = dateRules[month]
    } catch {
        // difficult case for months 2,4,8
        if (month==2) profileKey = (day<=20)?'Winter':'Uebergang';
        if (month==4) profileKey = (day<=14)?'Uebergang':'Sommer';
        if (month==8) profileKey = (day<=14)?'Sommer':'Uebergang';
    }

    return profileKey+"-"+workdayKey
}
function _saveQuartierConfig() {

    let dataObj = {}
    let ids = ['nameofhabitat', 'surface_sqm', 'consumption_per_sqm', 'nbr_persons', 'consumption_per_person', 'max_buffer_size']

    for(i in ids) {
        dataObj[ids[i]] = $('#'+ids[i]).val();
    }

    // see if we got renewable energy sources
    // to be found with the ids
    i = 0
    delete energysourceconfig
    while(true) {

        if ( $('#source_'+i).length ) {
            // element exists
            let name_of_source = $('#source_'+i).val()
            let power_of_source = $('#power_'+i).val()
            if (name_of_source!='') {
                energysourceconfig.push({'name': name_of_source, 'power': power_of_source})
            }
        }
        else break;
        i++
    }

    energysourceconfig.sort()

    dataObj['energysources'] = energysourceconfig

    $.ajax({
        type: "POST",
        url: "/setQuartierConfig",
        data: dataObj,
        dataType: "json",
        async: true,
        success: function(values) {

            _showStatus("Neue Quartierparameter: " + JSON.stringify(values))

            for (k in values) {
                key = values[k]
                $('#'+key).val(values[key])
            }

            $('#configHabitatDlg').modal('hide')
            alert("Neue Quartierwerte wurden gespeichert.")

        }
    });
}
function _displayInfos(_displayItems) {
    if (!_displayItems) _displayItems = displayItems
    let k = Object.keys(_displayItems)
    for( i in  k ) {
        let key = k[i]
        let value = displayItems[key]
        //console.log(key + " = " + JSON.stringify(value))
        $(key).text(value)
    }
    _setProgressBar((buffer_size/max_buffer_size)*100 )
}
function _cleanUp() {
    _displayInfos(displayItems)
    $('#pleaseWaitDialog').modal('hide')
    $('#timeStepper').removeClass("disabled")
}
function _findInList(energysourcename) {
    for(i in energysourceconfig) {
        let entry = energysourceconfig[i]
        if(entry.name==energysourcename) return entry
    }
    return false
}
function _setProgressBar(percent) {
    percent = (percent>100)?100:percent;
    percent = (percent<0)?0:percent;
    $('.progress-bar').css('width', percent+'%').attr('aria-valuenow', percent);
}

////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
// jquery functions
////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
// save quartier config --> To be changed to dialog
$('#saveQuartierConfigBtn').click( function() {
        $.ajax({
            type: "GET",
            url: "/clearEnergySources",
            async: false,
            success: () => {
                _saveQuartierConfig();
                $('#pleaseWaitDialog').modal('hide');
                $('#configHabitatDlg').modal();
            }
        });
    }
)
function setUseBuffer() {
    use_buffer = $('#use_buffer').prop('checked')
    _showStatus("Pufferspeicher genutzt: " + use_buffer)
    _computeNetDifference()
    _cleanUp()
}
// config dialog
function showHabitatConfigDlg() {
    getEnergysources()
    $('#configHabitatDlg').modal();
}
function getEnergysources() {
    $.ajax({
        type: "GET",
        url: "/energysources",
        async: false,
        success: list => {

            if(list.length!=0) {
                for (i in list) {
                    let name = list[i]['name']
                    let powerOfSource = list[i]['power']
                    if(_findInList(name)==false) {
                        energysourceconfig.push({'name': name, 'power': powerOfSource})
                        addNewEnergySource(name, powerOfSource)
                    }
                }
            }
        }
    });
}
function updateConsumptionPreview() {
    $('#min_consumption').val( _calculateBaseConsumption() )
    $('#max_consumption').val( calculateConsumptionForTimestep(simulationDate) )
}
function addNewEnergySource(_name, _power) {

        let newEntry = "" +
            "<div class='form-row'>" +
            "<div class='col'>" +
            "<label>Name</label>" +
            "<input type='text' class='form-control is-valid' id='source_" + srcNumber + "' value=" + _name + ">" +
            "</div>" +
            "<div class='col'>" +
            "<label>Nennleistung in kWh</label>" +
            "<input type='number' class='form-control is-valid' id='power_" + srcNumber + "' value=" + _power + ">" +
            "</div>" +
            "</div>"

        srcNumber++

        $('#listOfSources').append(newEntry)

}
function _loadConsumerConfig(cb) {
    $.ajax({
        type: "GET",
        url: "/getQuartierConfig",
        async: false,
        success: val => {
            max_buffer_size = displayItems['#max_buffer_size'] = val['max_buffer_size']
            buffer_size = displayItems['#buffer_size'] =  val['current_buffer_level']
            _displayInfos(displayItems)
            if(cb) cb()
        }
    });
}
function queryAccountBalances() {
    queryAccountBalance('balance_quartier')
    queryAccountBalance('balance_remote')
}
function queryAccountBalance(account) {

    $.ajax({
        type: "GET",
        url: "/"+account,
        async: false,
        success: val => {
            let balance = val.values.balance
            let diff = balance - balances[account]
            $('#'+account).text(balance)
            let el = $('#'+account+'_alert')
            el.removeClass()
            el.addClass( (diff<0)?"alert alert-danger":"alert alert-success" )
            balances[account] = balance

            $('#'+account+"_EUR").text( (balance / adjustmentFactorEnergyPrices ).toFixed(2) )
            let total = ((diff>0)?"+":"") + diff
            total = isNaN(total)?0:total;
            $('#last_transaction_'+account).text( total )
            let info = account + " = \t " + balance + " Wei"
            if(!isNaN(total))   info+=" (" + total + ")"
            _showStatus(info, true)
        }
    });

}
function setSimulationDates() {

    let startDate = $('#startDate').val()
    let endDate = $('#endDate').val()
    stats['simulationStart'] = startDate
    stats['simulationEnd'] = endDate

    simulationDate = startDate
    iterationStep = simulationDates.indexOf(simulationDate)+1
    _showStatus("#############################################", true)
    _showStatus("Simulationszeitraum: " + startDate + " - " + endDate, true)
    _showStatus("#############################################", true)

}
////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
// logging function
////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
$(document).keydown(function(e) {
    if (e.key === "Escape") {
        $('#looping').prop('checked', false)
    }
});

$(document).keyup(function(e) {
    if (e.key === "Escape") {
        $('#looping').prop('checked', false)
    }
});

$( document ).ready( initPage() )

function initPage() {

    openProtocolWindow()

    _showStatus("Bitte warten...")

    _loadConsumerConfig(getEnergysources)

    $('#use_buffer').prop('checked', use_buffer)

    loadSimulationData()

    loadUserLoadProfile()

    queryAccountBalances()

    $('#pleaseWaitDialog').modal('hide')

}
////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
$('#timeStepper').click( simulate )
$('#levelEnergy').click( _startBalancing )
$('#Lastprofil').change( loadUserLoadProfile )
$('#configHabitat').click ( showHabitatConfigDlg )
$('#surface_sqm').change( updateConsumptionPreview )
$('#consumption_per_sqm').change( updateConsumptionPreview )
$('#nbr_persons').change( updateConsumptionPreview )
$('#consumption_per_person').change( updateConsumptionPreview )
$('#saveHabitatConfigBtn').click ( _saveQuartierConfig )
$('#add_energy_source').click ( function() { addNewEnergySource('','')} )
$('#use_buffer').click( setUseBuffer )
$('#startDate').change(setSimulationDates)
$('#endDate').change(setSimulationDates)
$('#protocolWindow').click( openProtocolWindow )
$('#energyChart').click ( toggleScalingEnergy )
$('#differenceChart').click ( toggleScalingDifference )
/////////////////////////////////////////////
// protocol window
/////////////////////////////////////////////
function openProtocolWindow() {
    protocolWindow = window.open('', 'protocolWindow', "width=400,height=800,menubar=no,toolbar=no,location=no")
    protocolWindow.document.write("<pre>")
}
/////////////////////////////////////////////
// scaling of charts
/////////////////////////////////////////////

function toggleScalingEnergy() {
    type_energy = (type_energy === 'linear') ? 'logarithmic' : 'linear';
    chart.options.scales.yAxes[0].type = type_energy
    chart.update()
}
function toggleScalingDifference() {
    type_diff = (type_diff === linearScale) ? logarithmicScale : linearScale;
    diffchart.options.scales.yAxes[0].type = type_diff
    diffchart.update()
}

function _showStatus(msg, logonly) {



        if(protocolWindow!=null) {
            if (msg!='') console.log(msg)
            protocolWindow.document.write(msg+"\r")
            protocolWindow.document.body.scrollTo(0, protocolWindow.document.body.scrollHeight )
        }

    if (!logonly){
        $('#pleaseWaitDialog').modal()
        $('#simulationStatus').html(msg)
        $('#simulationStatusMsg').html(msg)
    }
    _displayInfos()

}