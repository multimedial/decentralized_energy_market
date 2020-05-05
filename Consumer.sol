///////////////////////////////////////////////////////////////////////////////////////////////////////////////////
// Smart contract for a decentralized energy market
//
//
// author: Christophe Leske 
// info: info@multimedial.de
// created: 24th of apr 2020
//
// Version: 1.0
//
///////////////////////////////////////////////////////////////////////////////////////////////////////////////////

pragma solidity >=0.4.22 <0.7.0;
pragma experimental ABIEncoderV2;

import "./energysources/EnergySource.sol";
import "./energysources/Turbine.sol";
import "./energysources/Solarcell.sol";
import "./LevellingNode.sol";


contract Consumer {
   
    
    // address of contract owner
    address owner;
    
    //optional  name of habitat
    string nameofhabitat = "n/a";
    
    // surface of the habitat
    uint surface_sqm = 0;
    
    // base consumption of the habitat per square metre
    uint consumption_per_sqm = 0;
    
    // number of persons in habitat
    uint nbr_persons = 0;
    
    // consumption per person in habitat
    uint consumption_per_person = 0;
    
    // ADD the reneweable energy sources
    EnergySource[] energysources;
    
    bool useBuffer = false;
    uint energyBuffer = 0;
    uint maxEnergyBuffer = 100000;
    
    
    // address of the energyMarketTrader-contract to call
    address energyMarket;

    string [] names;
    
    event logMsg(string, int);
    
    modifier onlyOwnerOrSmartContract {
        require(
            ( ( msg.sender ==  owner ) || ( msg.sender == address(this) )),
            "Sender not authorized."
        );
        _;
    }
    
    
    // Constructor of contract    
    constructor (string memory _nameofhabitat, uint _surface_sqm, uint _consumption_per_sqm, uint _nbr_persons) public {
        ////////////////////////////////////////
        // init  class variables
        ////////////////////////////////////////
        
        // store owner of contract
        owner = msg.sender;
        
        // store surface in sqm
        surface_sqm = (_surface_sqm==0) ? 1000 : _surface_sqm;
        
        // store consumption_per_sqm
        consumption_per_sqm = (_consumption_per_sqm==0) ? 10: _consumption_per_sqm;
        
        // stroe nbr of person
        nbr_persons = (_nbr_persons==0)?10:_nbr_persons;
        
        // store name of habitat
        bytes memory tempEmptyStringTest = bytes(_nameofhabitat);
        
        nameofhabitat = (tempEmptyStringTest.length==0)?"test":_nameofhabitat;
        
        // testvalues
        addEnergySource(EnergySource.EnergySourceType.Solar, "Dachpanel", 300,50000);
        addEnergySource(EnergySource.EnergySourceType.Wind, "Turbinen Vorplatz", 1000,1000000);
        
        logMsg("Total number of energy sources: ", int(energysources.length));
        
        dumpEnergySources();

    }
    
    function fund() public payable {
        logMsg("RECEIVED: ", int(msg.value));
    }
    
    function getAccountBalance() public view onlyOwnerOrSmartContract returns (uint){
        return address(this).balance;
    }
    
    
    function addEnergySource(EnergySource.EnergySourceType _energytype, string memory name, uint min, uint max) public onlyOwnerOrSmartContract returns (string memory) {
        
        EnergySource newEnergySource;
        
        // store new energysource
        if (_energytype==EnergySource.EnergySourceType.Solar) {
            newEnergySource = new Solarcell(name, min, max);
        } else if (_energytype==EnergySource.EnergySourceType.Wind) {
            newEnergySource = new Turbine(name, min, max);
        } else if (_energytype==EnergySource.EnergySourceType.Wind) {
            newEnergySource = new Turbine(name, min, max);
        } else if (_energytype==EnergySource.EnergySourceType.Wind) {
            newEnergySource = new Turbine(name, min, max);
        } else {
            // energysource not recognized!
            return "ERROR - energy source not recognized!";
        }
        
        energysources.push(newEnergySource);
        
        return name;
        
    }
   
    // DEBUG
    function dumpEnergySources() public {
        for (uint i=0;i<energysources.length;i++) {
            emit logMsg(energysources[i].getName(), int(energysources[i].getMaxOutput()));
        }
    }
    
    
    function computeEnergyConsumption() public view returns (uint) {
        // computes the total consumption of habitat
        return (surface_sqm * consumption_per_sqm ) + ( nbr_persons * consumption_per_person );
    }
    
    
    function computeEnergyProduction() public returns (uint) {
        
        uint total=0;
        
        for (uint i=0;i<energysources.length;i++) {
            
            uint energyproduced = energysources[i].produceEnergy(1);
            total += energyproduced;
            
            // DEBUG
            emit logMsg( energysources[i].getName(), int(energyproduced));
        }
        
        return total;
        
     }
     
     
    function isBufferBeingUsed() public view returns (bool) {
         return useBuffer;
     }
    
     
    function useEnergyBuffer(bool _useBuffer) public returns (bool){
         
         if(!useBuffer) {
             return false;
         }

         useBuffer = _useBuffer;
         return true;
         
     }
     
     
    function fillBuffer(uint amount) public returns (bool){
         
         if(!useBuffer) {
             return false;
         }


         energyBuffer += amount;
         
         if (energyBuffer>maxEnergyBuffer) {
             uint surplus = energyBuffer-maxEnergyBuffer;
             energyBuffer = maxEnergyBuffer;
             sellEnergy(EnergySource.EnergySourceType.Unknown, surplus);
         }
         
         return true;
         
     }
     
     
    function getBufferLevel() public view returns (uint) {
         if(!useBuffer) {
             return 0;
         }
         return energyBuffer;
     }
     
     
    function setMaxEnergyBuffer(uint amount) public {
         maxEnergyBuffer = amount;
     }
    
     
    function getMaxEnergyBuffer() public view returns (uint){
         return maxEnergyBuffer;
     }
    
    
    function computeEnergyDifference() public returns (int) {
        
        // computes the difference between 
        uint energyProduced = computeEnergyProduction();
        uint energyConsumed = computeEnergyConsumption();
        
        int difference = int(energyProduced - energyConsumed);
        
        
        emit logMsg("Energy produced", int(energyProduced));
        emit logMsg("Energy consumed", int(energyConsumed));
        
        // deficit
        if (difference<0) {
            
            emit logMsg("--- ENERGY DEFICIT ---", difference);    
            
            if (useBuffer) {
                
                if (energyBuffer>0) {
                    emit logMsg("Applying buffered energy", difference);    
                    
                    if (uint(difference)<=energyBuffer) {
                        // buffer is big enough to nivellate energy deficit
                        // needs to be added, as the difference is negative
                        energyBuffer -= uint(difference); 
                        difference = 0;
                    }
                    
                }
                emit logMsg("Energy Buffer level", int(energyBuffer));
            }

            buyEnergy(uint(difference));
        }
        
        // surplus
        if (difference>0) {
            emit logMsg("+++ ENERGY SURPLUS +++", difference);    
            sellEnergy( EnergySource.EnergySourceType.Unknown, uint(difference) );
        }
        
        // even
        if (difference==0) {
            emit logMsg("+- ENERGY IS BALANCED -+", difference);    
        }

        return difference;
    }
    
    
    function buyEnergy(uint amount) public returns (bool){
        // emit call to smart contract of levelling node
        // levelling
        emit logMsg("BUYING kw/h:", int(amount));
        
        // energyMarket.call({gas: 1000000, value: 1 ether, ("buyEnergy", "", amount);
        
        return false;
    }
    
    
    function sellEnergy(EnergySource.EnergySourceType energytype, uint amount) private returns (bool){
        // emit call to smart contract of levelling node
        // levelling
        emit logMsg("SELLING kw/h:", int(amount));
        //energyMarket.call.gas(1000000).value(1 ether)("sellEnergy", energytype, amount);
        // do the call
        
        return false;   
        
    }
    
    
    function registerEnergyMarketNode(address _energyMarket) public returns (bool){
        energyMarket = _energyMarket;
        return true;
    }
    
}
