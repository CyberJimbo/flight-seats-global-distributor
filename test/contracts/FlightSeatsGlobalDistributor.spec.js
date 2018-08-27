const FlightSeatsGlobalDistributor = artifacts.require("FlightSeatsGlobalDistributor.sol");
const Web3Utils = require("web3-utils");

contract("FlightSeatsGlobalDistributor", ([contractOwner, passenger, airline, hacker]) => {

  const departureDate = Math.floor(Date.now() / 1000) + 8640000;
  const seatOccupiedStatus = {'Vacant':0, 'Occupied':1};

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
    const origin = 'LHR';
    const destination = 'JFK';
    const airlineCode = 'DL';
    const airlineName = "Delta Airlines";

    const pseudoRandomNumber = Math.floor(Date.now() / 1000);
    const hash = Web3Utils.soliditySha3(
        { type: 'bytes32', value: flightId },
        { type: 'address', value: airline },
        { type: 'uint256', value: pseudoRandomNumber },
    );
    const signature = web3.eth.sign(airline, hash);

    await seatsDistributor.createFlight(
        flightNumber,
        Web3Utils.hexToBytes(Web3Utils.toHex(origin)),
        Web3Utils.hexToBytes(Web3Utils.toHex(destination)),
        departureDate,
        Web3Utils.hexToBytes(Web3Utils.toHex(airlineCode)),
        airlineName,
        3,
        airline,
        signature,
        pseudoRandomNumber,
        {
          from: airline
        }
    );

    const expectedAirlineAddresses = await seatsDistributor.getActiveAirlines();
    assert.equal(expectedAirlineAddresses[1], airline);  // expectedAirlineAddresses[0] will be the contractOwner who prepopulates a flight in the contract constructor

    const flightIdsForAirline = await seatsDistributor.getFlightIdsForAirline(airline);
    assert.equal(flightIdsForAirline.length, 1);
  });


  it("should not create a flight when departure date is in the past", async () => {

    const seatsDistributor = await FlightSeatsGlobalDistributor.deployed();
    const flightNumber = 'DL555';
    const departureDateInPast = Math.floor(Date.now() / 1000) - 86400;
    const flightId = await seatsDistributor.getFlightId(flightNumber, departureDateInPast);
    const origin = 'LHR';
    const destination = 'JFK';
    const airlineCode = 'DL';
    const airlineName = "Delta Airlines";

    const pseudoRandomNumber = Math.floor(Date.now() / 1000);
    const hash = Web3Utils.soliditySha3(
        { type: 'bytes32', value: flightId },
        { type: 'address', value: airline },
        { type: 'uint256', value: pseudoRandomNumber },
    );
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
          6,
          airline,
          signature,
          pseudoRandomNumber,
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
    const seatNumbers = ['0x31410000', '0x31420000', '0x31430000']; //bytes4 hex values for 1A, 1B, 1C, 1D
    const seatPrices = [1000000000000000000, 2000000000000000000, 3000000000000000000];
    const cabinClass = {'Economy':0, 'Business':1, 'First':2};

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


  it("airline cannot add more seat inventory than the total number of seats for this flight", async () => {

    // the maximum allowed 3 seats for this flight were added in the preceding unit test, adding more here should cause failure.
    const seatsDistributor = await FlightSeatsGlobalDistributor.deployed();
    const flightNumber = 'DL555';
    const seatNumbers = ['0x31440000', '0x31450000', '0x31460000']; //bytes4 hex values for 1A, 1B, 1C.
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
            from: airline
          }
      );
      complete = true;
    }
    catch (err) {
    }

    assert.equal(complete, false);

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

    await seatsDistributor.bookSeat(
        seatId,
        {
          from: passenger,
          value: seatPriceWei
        }
    );

    const erc721TokenOwner = await seatsDistributor.ownerOf(seatId);
    assert.equal(passenger, erc721TokenOwner);

    const erc721TokenApproved = await seatsDistributor.getApproved(seatId);
    assert.equal(airline, erc721TokenApproved);

    const seat = await seatsDistributor.getSeat(seatId);
    assert.equal(seat[3], seatOccupiedStatus.Occupied);

    // Now airline calls withdrawFlightFees to pull the flight fee from the contract.

    const airlineOriginalWeiBalance = await web3.eth.getBalance(airline);
    const receipt = await seatsDistributor.withdrawFlightFees(
        airline,
        {
          from: airline
        }
    );

    const tx = await web3.eth.getTransaction(receipt.tx);
    const gasCost = tx.gasPrice.mul(receipt.receipt.gasUsed);

    const airlineFinalWeiBalance = await web3.eth.getBalance(airline);
    const expectedEth = parseFloat(Web3Utils.fromWei(airlineOriginalWeiBalance.toString(), "ether")) + seatPriceEth -  parseFloat(Web3Utils.fromWei(gasCost.toString(), "ether"));
    const expectedWeiBalance = Web3Utils.toWei(expectedEth.toString(), "ether");

    assert.equal(airlineFinalWeiBalance.toNumber(), expectedWeiBalance);


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

    const seat = await seatsDistributor.getSeat(seatId);
    assert.equal(seat[5], true); //checked in flag on seat

  });


  it("ensures only the passenger who owns the ERC721 Seat can checkin this seat for their flight ", async () => {

    const seatsDistributor = await FlightSeatsGlobalDistributor.deployed();
    const flightIdsForAirline = await seatsDistributor.getFlightIdsForAirline(airline);
    const flightId = flightIdsForAirline[0];
    const seatIdsForFlight = await seatsDistributor.getSeatsForFlight(flightId);
    const seatId = seatIdsForFlight[1];

    const seatPriceEth = 2;
    const seatPriceWei = Web3Utils.toWei(seatPriceEth.toString(), "ether");

    await seatsDistributor.bookSeat(
        seatId,
        {
          from: passenger,
          value: seatPriceWei
        }
    );

    const erc721TokenOwner = await seatsDistributor.ownerOf(seatId);
    assert.equal(passenger, erc721TokenOwner);

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
    const seatId = seatIdsForFlight[2];

    const seatPriceEth = 3;
    const seatPriceWei = Web3Utils.toWei(seatPriceEth.toString(), "ether");

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

    await seatsDistributor.withdrawFlightFees(
        airline,
        {
          from: airline
        }
    );

    const erc721TokenOwner = await seatsDistributor.ownerOf(seatId);
    assert.equal(passenger, erc721TokenOwner);
  });


  it("airline can cancel a seat booking, airline takes back the ER721 Seat token and places a BookingRefund in a queue to process later", async () => {

    const seatsDistributor = await FlightSeatsGlobalDistributor.deployed();
    const flightIdsForAirline = await seatsDistributor.getFlightIdsForAirline(airline);
    const flightId = flightIdsForAirline[0];
    const seatIdsForFlight = await seatsDistributor.getSeatsForFlight(flightId);
    const seatIdCancelledByAirline = seatIdsForFlight[1];

    // const seatPriceEth = 2;
    // const seatPriceWei = Web3Utils.toWei(seatPriceEth.toString(), "ether");
    // const passengerOriginalWeiBalance = await web3.eth.getBalance(passenger);

    await seatsDistributor.cancelSeatBooking(
        seatIdCancelledByAirline,
        {
          from: airline
        }
    );

    const erc721TokenOwnerForAirlineCancelled = await seatsDistributor.ownerOf(seatIdCancelledByAirline);
    assert.equal(airline, erc721TokenOwnerForAirlineCancelled);

    const seatCancelledByAirline = await seatsDistributor.getSeat(seatIdCancelledByAirline);
    assert.equal(seatCancelledByAirline[3], seatOccupiedStatus.Vacant);


    const seatIdCancelledByPassenger = seatIdsForFlight[2];
    await seatsDistributor.cancelSeatBooking(
        seatIdCancelledByPassenger,
        {
          from: passenger
        }
    );

    const erc721TokenOwnerForPassengerCancelled = await seatsDistributor.ownerOf(seatIdCancelledByPassenger);
    assert.equal(airline, erc721TokenOwnerForPassengerCancelled);

    const seatCancelledByPassenger = await seatsDistributor.getSeat(seatIdCancelledByPassenger);
    assert.equal(seatCancelledByPassenger[3], seatOccupiedStatus.Vacant);

    const amountToRefund = seatCancelledByAirline[2].plus(seatCancelledByPassenger[2]);
    console.log('amountToRefund ' + amountToRefund);

    const pseudoRandomNumber = Math.floor(Date.now() / 1000);
    const hash = Web3Utils.soliditySha3(
        { type: 'address', value: airline },
        { type: 'uint256', value: amountToRefund },
        { type: 'uint256', value: pseudoRandomNumber }
    );
    const signature = web3.eth.sign(airline, hash);

    const passengerOriginalWeiBalance = await web3.eth.getBalance(passenger);

    await seatsDistributor.processAirlineRefunds(
        amountToRefund,
        pseudoRandomNumber,
        signature,
        {
          from: airline,
          value: amountToRefund
        }
    );

    const passengerFinalWeiBalance = await web3.eth.getBalance(passenger);
    const expectedEth = parseFloat(Web3Utils.fromWei(passengerOriginalWeiBalance.toString(), "ether")) + parseFloat(Web3Utils.fromWei(amountToRefund.toString(), "ether"));
    const expectedWeiBalance = Web3Utils.toWei(expectedEth.toString(), "ether");

    assert.equal(passengerFinalWeiBalance.toNumber(), expectedWeiBalance);


  });



  // it("passenger can cancel a seat booking, airline takes back the ER721 Seat token and places a BookingRefund in a queue to process later", async () => {
  //
  //   const seatsDistributor = await FlightSeatsGlobalDistributor.deployed();
  //   const flightIdsForAirline = await seatsDistributor.getFlightIdsForAirline(airline);
  //   const flightId = flightIdsForAirline[0];
  //   const seatIdsForFlight = await seatsDistributor.getSeatsForFlight(flightId);
  //   let seatId = seatIdsForFlight[5];
  //
  //   // const seatPriceEth = 3;
  //   // const seatPriceWei = Web3Utils.toWei(seatPriceEth.toString(), "ether");
  //
  //   await seatsDistributor.cancelSeatBooking(
  //       seatId,
  //       {
  //         from: passenger
  //       }
  //   );
  //
  //   const erc721TokenOwner = await seatsDistributor.ownerOf(seatId);
  //   assert.equal(airline, erc721TokenOwner);
  //
  //   const seat1 = await seatsDistributor.getSeat(seatId);
  //   assert.equal(seat1[3], seatOccupiedStatus.Vacant);
  //
  //   seatId = seatIdsForFlight[6];
  //
  //   await seatsDistributor.cancelSeatBooking(
  //       seatId,
  //       {
  //         from: passenger
  //       }
  //   );
  //
  //   const erc721TokenOwner2 = await seatsDistributor.ownerOf(seatId);
  //   assert.equal(airline, erc721TokenOwner2);
  //
  //   const seat2 = await seatsDistributor.getSeat(seatId);
  //   assert.equal(seat2[3], seatOccupiedStatus.Vacant);
  //
  //
  //   //
  //   // console.log('seat number is ' + seat[1]);
  //   // console.log('seatPrice is ' + seat[2]);
  //
  //   // const passengerOriginalWeiBalance = await web3.eth.getBalance(passenger);
  //   //
  //   // const pseudoRandomNumber = Math.floor(Date.now() / 1000);
  //   // const hash = Web3Utils.soliditySha3(
  //   //     { type: 'address', value: airline },
  //   //     { type: 'uint256', value: seatPriceWei },
  //   //     { type: 'uint256', value: pseudoRandomNumber }
  //   // );
  //   // const signature = web3.eth.sign(airline, hash);
  //   //
  //   // await seatsDistributor.processAirlineRefunds(
  //   //     seatPriceWei,
  //   //     pseudoRandomNumber,
  //   //     signature,
  //   //     {
  //   //       from: airline,
  //   //       value: seatPriceWei
  //   //     }
  //   // );
  //   //
  //   // const passengerFinalWeiBalance = await web3.eth.getBalance(passenger);
  //   // const expectedEth = parseFloat(Web3Utils.fromWei(passengerOriginalWeiBalance.toString(), "ether")) + seatPriceEth;
  //   // const expectedWeiBalance = Web3Utils.toWei(expectedEth.toString(), "ether");
  //   //
  //   // assert.equal(passengerFinalWeiBalance.toNumber(), expectedWeiBalance);
  //
  // });
  //
  // it("airline can process the refunds for the passenger, the refunds were triggered when the airline/passenger cancelled the seats ", async () => {
  //
  //   const seatPriceEth = 3;
  //   const seatPriceWei = Web3Utils.toWei(seatPriceEth.toString(), "ether");
  //   const passengerOriginalWeiBalance = await web3.eth.getBalance(passenger);
  //
  //   const pseudoRandomNumber = Math.floor(Date.now() / 1000);
  //   const hash = Web3Utils.soliditySha3(
  //       { type: 'address', value: airline },
  //       { type: 'uint256', value: seatPriceWei },
  //       { type: 'uint256', value: pseudoRandomNumber }
  //   );
  //   const signature = web3.eth.sign(airline, hash);
  //
  //   await seatsDistributor.processAirlineRefunds(
  //       seatPriceWei,
  //       pseudoRandomNumber,
  //       signature,
  //       {
  //         from: airline,
  //         value: seatPriceWei
  //       }
  //   );
  //
  //   const passengerFinalWeiBalance = await web3.eth.getBalance(passenger);
  //   const expectedEth = parseFloat(Web3Utils.fromWei(passengerOriginalWeiBalance.toString(), "ether")) + seatPriceEth;
  //   const expectedWeiBalance = Web3Utils.toWei(expectedEth.toString(), "ether");
  //
  //   assert.equal(passengerFinalWeiBalance.toNumber(), expectedWeiBalance);
  //
  //
  // });

});
