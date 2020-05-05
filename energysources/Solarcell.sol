pragma solidity >=0.4.22 <0.7.0;

import "./EnergySource.sol";


contract Solarcell is EnergySource {
    
    constructor( string memory _name, uint _min_output_kwh, uint _max_output_kwh ) EnergySource(_name, _min_output_kwh, _max_output_kwh ) public {
        
        energysourcetype = EnergySourceType.Solar;        
        
    }

}