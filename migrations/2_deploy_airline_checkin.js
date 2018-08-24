var FlightSeatsGlobalDistributor = artifacts.require("./FlightSeatsGlobalDistributor.sol")

module.exports= function(deployer){
    deployer.deploy(FlightSeatsGlobalDistributor);
}
