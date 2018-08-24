const FlightSeatsGlobalDistributor = artifacts.require("FlightSeatsGlobalDistributor.sol");
const Web3Utils = require("web3-utils");

contract("FlightSeatsGlobalDistributor", ([contractOwner, passenger, airline, hacker]) => {

  const departureDate = Math.floor(Date.now() / 1000) + 8640000;
  console.log('departure date is ' + departureDate);

  it("constructor allows the contract owner to prepopulate a flight for demo purposes", async () => {

    const seatsDistributor = await FlightSeatsGlobalDistributor.deployed();

    const flightNumber = Web3Utils.hexToBytes(Web3Utils.toHex('BA125'));
    const flightId = await seatsDistributor.getFlightId(flightNumber, 1543734893);
    const signature = web3.eth.sign(contractOwner, flightId);

    console.log('flightNumber ', flightNumber);
    console.log('flightId ', flightId);
    console.log('creating signature is ' + signature)

    const expectedAirlineAddresses = await seatsDistributor.getActiveAirlines();
    console.log('expectedAirlineAddresses ' + expectedAirlineAddresses);
    assert.equal(expectedAirlineAddresses[0], contractOwner);  // expectedAirlineAddresses[0] will be the contractOwner who prepopulates a flight in the contract constructor

    // const flightIdsForAirline = await seatsDistributor.getFlightIdsForAirline(contractOwner);
    // console.log('flightIdsForAirline ' + expectedAirlineAddresses);
    // assert.equal(flightIdsForAirline.length, 1);
  });

  it("an airline can create a flight", async () => {

    const seatsDistributor = await FlightSeatsGlobalDistributor.deployed();
    const flightNumber = Web3Utils.hexToBytes(Web3Utils.toHex('DL555'));
    const flightId = await seatsDistributor.getFlightId(flightNumber, departureDate);
    console.log('flightId ', flightId);

    const origin = 'LHR';
    const destination = 'JFK';
    const airlineCode = 'DL';
    const airlineName = "Delta Airlines";
    // const hash = Web3Utils.soliditySha3(flightNumber, "_", departureDate);
    const hash = Web3Utils.soliditySha3(airlineName);
    const signature = web3.eth.sign(airline, flightId);
    // console.log('hex flight ' + Web3Utils.hexToBytes(Web3Utils.toHex(flightNumber)));
    // console.log('creating signature is ' + signature)
    // console.log('creating hash is ' + hash)


    await seatsDistributor.createFlight(
        flightNumber,
        Web3Utils.hexToBytes(Web3Utils.toHex(origin)),
        Web3Utils.hexToBytes(Web3Utils.toHex(destination)),
        departureDate,
        Web3Utils.hexToBytes(Web3Utils.toHex(airlineCode)),
        airlineName,
        airline,
        signature,
        {
          from: airline
        }
    );

    const expectedAirlineAddresses = await seatsDistributor.getActiveAirlines();
    console.log('expectedAirlineAddresses ' + expectedAirlineAddresses);
    assert.equal(expectedAirlineAddresses[1], airline);  // expectedAirlineAddresses[0] will be the contractOwner who prepopulates a flight in the contract constructor

    const flightIdsForAirline = await seatsDistributor.getFlightIdsForAirline(airline);
    assert.equal(flightIdsForAirline.length, 1);
  });


  // it("departure date test", async () => {
  //
  //   function toHex(str) {
  //     var hex = ''
  //     for (var i = 0; i < str.length; i++) {
  //       hex += '' + str.charCodeAt(i).toString(16)
  //     }
  //     return hex
  //   }
  //
  //   function add_months(dt, n) {
  //
  //     return new Date(dt.setMonth(dt.getMonth() + n));
  //   }
  //
  //   const flightNumber = 'BA124';
  //   console.log('airline ' + airline);
  //   // var now = Date.now();
  //   // const departureDate = new Date();
  //   // add_months(departureDate, 2);
  //   // console.log('departureDate is ' + (departureDate.getTime() / 1000));
  //
  //   let hash = Web3Utils.soliditySha3(flightNumber + "_" + 1542412800);
  //   const signature = web3.eth.sign(contractOwner, hash);
  //   console.log('contractOwner ' + contractOwner);
  //   console.log('signature is ' + signature);
  //
  //   const address = '0x6885f585cc82a6856534d86c71d87dc3525feeb2';
  //   console.log('checksum address ' + Web3Utils.toChecksumAddress(address));
  // });



  it("should not create a flight when departure date is in the past", async () => {

    const seatsDistributor = await FlightSeatsGlobalDistributor.deployed();
    const flightNumber = 'DL555';
    const origin = 'LHR';
    const destination = 'JFK';
    const departureDateInPast = Math.floor(Date.now() / 1000) - 86400;
    const airlineCode = 'DL';
    const airlineName = "Delta Airlines";
    const hash = Web3Utils.soliditySha3(airlineName);
    const signature = web3.eth.sign(airline, hash);

    let complete = false;

    try {
      await seatsDistributor.createFlight(
          Web3Utils.hexToBytes(Web3Utils.toHex(flightNumber)),
          Web3Utils.hexToBytes(Web3Utils.toHex(origin)),
          Web3Utils.hexToBytes(Web3Utils.toHex(destination)),
          departureDateInPast,
          Web3Utils.hexToBytes(Web3Utils.toHex(airlineCode)),
          airlineName,
          airline,
          signature,
          {
            from: airline
          }
      );
      complete = true;
    }
    catch (err) {
    }

    assert.equal(complete, false);
  });


  it("airline can add seat inventory to their flight cabins", async () => {

    const seatsDistributor = await FlightSeatsGlobalDistributor.deployed();
    const flightNumber = 'DL555';
    const seatNumbers = ['0x31410000', '0x31420000', '0x31430000']; //bytes4 hex values for 1A, 1B, 1C.
    const seatPrices = [1000000000000000000, 2000000000000000000, 3000000000000000000];
    const cabinClass = {'Economy':0, 'Business':1, 'First':2};
    const seatOccupiedStatus = {'Vacant':0, 'Occupied':1};

    await seatsDistributor.addSeatInventoryToFlightCabin(
        Web3Utils.hexToBytes(Web3Utils.toHex(flightNumber)),
        departureDate,
        seatNumbers,
        seatPrices,
        cabinClass.Economy,
        {
          from: airline
        }
    );

    const flightIdsForAirline = await seatsDistributor.getFlightIdsForAirline(airline);
    const flightId = flightIdsForAirline[0];
    const seatIdsForFlight = await seatsDistributor.getSeatsForFlight(flightId);
    let seatId;
    for (let i = 0; i < seatIdsForFlight.length; i++) {
      seatId = seatIdsForFlight[i];
      const seat = await seatsDistributor.getSeat(seatId);
      assert.equal(seatNumbers.includes(seat[1]), true);
      assert.equal(seatPrices.includes(seat[2].toNumber()), true);
      assert.equal(seat[3], seatOccupiedStatus.Vacant);
      assert.equal(seat[4], cabinClass.Economy);
      assert.equal(seat[5], false);
    }
  });


  it("ensures only the airline who owns the flight can add seat inventory to this flight", async () => {

    const seatsDistributor = await FlightSeatsGlobalDistributor.deployed();
    const flightNumber = 'DL555';
    const seatNumbers = ['0x31410000', '0x31420000', '0x31430000']; //bytes4 hex values for 1A, 1B, 1C.
    const seatPrices = [1000000000000000000, 2000000000000000000, 3000000000000000000];
    const cabinClass = {'Economy':0, 'Business':1, 'First':2};

    let complete = false;

    try {
    await seatsDistributor.addSeatInventoryToFlightCabin(
        Web3Utils.hexToBytes(Web3Utils.toHex(flightNumber)),
        departureDate,
        seatNumbers,
        seatPrices,
        cabinClass.Economy,
        {
          from: hacker
        }
    );
      complete = true;
    }
    catch (err) {
    }

    assert.equal(complete, false);
  });


  it("passenger can book a seat on a flight and receive a unique ER721 Seat token", async () => {

    const seatsDistributor = await FlightSeatsGlobalDistributor.deployed();
    const flightIdsForAirline = await seatsDistributor.getFlightIdsForAirline(airline);
    const flightId = flightIdsForAirline[0];
    const seatIdsForFlight = await seatsDistributor.getSeatsForFlight(flightId);
    const seatId = seatIdsForFlight[0];

    const seatPriceEth = 1;
    const seatPriceWei = Web3Utils.toWei(seatPriceEth.toString(), "ether");
    const airlineOriginalWeiBalance = await web3.eth.getBalance(airline);

    await seatsDistributor.bookSeat(
        seatId,
        {
          from: passenger,
          value: seatPriceWei
        }
    );

    const airlineFinalWeiBalance = await web3.eth.getBalance(airline);
    const expectedEth = parseFloat(Web3Utils.fromWei(airlineOriginalWeiBalance.toString(), "ether")) + seatPriceEth;
    const expectedWeiBalance = Web3Utils.toWei(expectedEth.toString(), "ether");

    assert.equal(airlineFinalWeiBalance.toNumber(), expectedWeiBalance);

    const erc721TokenOwner = await seatsDistributor.ownerOf(seatId);
    assert.equal(passenger, erc721TokenOwner);

    // const seat = await seatsDistributor.getSeat(seatId);

  });


  it("ensures amount sent by passenger covers the cost of seat", async () => {

    const seatsDistributor = await FlightSeatsGlobalDistributor.deployed();
    const flightIdsForAirline = await seatsDistributor.getFlightIdsForAirline(airline);
    const flightId = flightIdsForAirline[0];
    const seatIdsForFlight = await seatsDistributor.getSeatsForFlight(flightId);
    const seatId = seatIdsForFlight[2]; //costs 3 ETH

    let complete = false;

    try {
      await seatsDistributor.bookSeat(
          seatId,
          {
            from: passenger,
            value: Web3Utils.toWei("1")
          }
      );
      complete = true;
    }
    catch (err) {
    }

    assert.equal(complete, false);
  });


  it("passenger can checkin for their flight, which burns their ERC721 seat token and sends back a new ERC721 Boarding Pass token. ", async () => {

    const seatsDistributor = await FlightSeatsGlobalDistributor.deployed();
    const flightIdsForAirline = await seatsDistributor.getFlightIdsForAirline(airline);
    const flightId = flightIdsForAirline[0];
    const seatIdsForFlight = await seatsDistributor.getSeatsForFlight(flightId);
    const seatId = seatIdsForFlight[0];

    const barcodeStringParams = await seatsDistributor.getBarcodeStringParametersForBoardingPass(seatId);
    const barcodeStringForBoardingPass = web3.toUtf8(barcodeStringParams[0]) +
        web3.toUtf8(barcodeStringParams[1]).trim() +
        web3.toUtf8(barcodeStringParams[2]).trim() +
        barcodeStringParams[3] +
        web3.toUtf8(barcodeStringParams[4]).trim();

    const ipfsUrlForPassportScan = Web3Utils.hexToBytes(Web3Utils.toHex('https://ipfs.io/ipfs/Qmaj7LUwb7T5sMFyznMGS1cAGPyVJL6Vhjwemq4zb1Nbex'));

    await seatsDistributor.checkinPassenger(
        seatId,
        barcodeStringForBoardingPass,
        ipfsUrlForPassportScan,
        {
          from: passenger,
          value: 0
        }
    );

    const erc721SeatExists = await seatsDistributor.exists(seatId);
    assert.equal(erc721SeatExists, false);

    const boardingPass = await seatsDistributor.getBoardingPassForSeat(seatId);
    const boardPassId = boardingPass[0];
    const erc721TokenOwner = await seatsDistributor.ownerOf(boardPassId);
    assert.equal(passenger, erc721TokenOwner);

  });


  it("ensures only the passenger who owns the ERC721 Seat can checkin this seat for their flight ", async () => {

    const seatsDistributor = await FlightSeatsGlobalDistributor.deployed();
    const flightIdsForAirline = await seatsDistributor.getFlightIdsForAirline(airline);
    const flightId = flightIdsForAirline[0];
    const seatIdsForFlight = await seatsDistributor.getSeatsForFlight(flightId);
    const seatId = seatIdsForFlight[0];

    const barcodeStringParams = await seatsDistributor.getBarcodeStringParametersForBoardingPass(seatId);
    const barcodeStringForBoardingPass = web3.toUtf8(barcodeStringParams[0]) +
        web3.toUtf8(barcodeStringParams[1]).trim() +
        web3.toUtf8(barcodeStringParams[2]).trim() +
        barcodeStringParams[3] +
        web3.toUtf8(barcodeStringParams[4]).trim();

    const ipfsUrlForPassportScan = Web3Utils.hexToBytes(Web3Utils.toHex('https://ipfs.io/ipfs/Qmaj7LUwb7T5sMFyznMGS1cAGPyVJL6Vhjwemq4zb1Nbex'));

    let complete = false;

    try {
      await seatsDistributor.checkinPassenger(
          seatId,
          barcodeStringForBoardingPass,
          ipfsUrlForPassportScan,
          {
            from: hacker,
            value: 0
          }
      );
      complete = true;
    }
    catch (err) {
    }

    assert.equal(complete, false);
  });


  it("passenger cannot book a seat when the contract has been paused via emergency-stop, can then book again once contract has been unpaused.", async () => {

    const seatsDistributor = await FlightSeatsGlobalDistributor.deployed();
    const flightIdsForAirline = await seatsDistributor.getFlightIdsForAirline(airline);
    const flightId = flightIdsForAirline[0];
    const seatIdsForFlight = await seatsDistributor.getSeatsForFlight(flightId);
    const seatId = seatIdsForFlight[1];

    const seatPriceEth = 2;
    const seatPriceWei = Web3Utils.toWei(seatPriceEth.toString(), "ether");
    const airlineOriginalWeiBalance = await web3.eth.getBalance(airline);

    await seatsDistributor.pause();

    let complete = false;
    try {
      await seatsDistributor.bookSeat(
          seatId,
          {
            from: passenger,
            value: seatPriceWei
          }
      );
      complete = true;
    }
    catch (err) {
    }

    assert.equal(complete, false);
    await seatsDistributor.unpause();

    try {
      await seatsDistributor.bookSeat(
          seatId,
          {
            from: passenger,
            value: seatPriceWei
          }
      );
      complete = true;
    }
    catch (err) {
    }

    assert.equal(complete, true);

    const airlineFinalWeiBalance = await web3.eth.getBalance(airline);
    const expectedEth = parseFloat(Web3Utils.fromWei(airlineOriginalWeiBalance.toString(), "ether")) + seatPriceEth;
    const expectedWeiBalance = Web3Utils.toWei(expectedEth.toString(), "ether");
    assert.equal(airlineFinalWeiBalance.toNumber(), expectedWeiBalance);

    const erc721TokenOwner = await seatsDistributor.ownerOf(seatId);
    assert.equal(passenger, erc721TokenOwner);
  });

});
