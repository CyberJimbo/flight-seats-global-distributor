App = {
  web3Provider: null,
  contracts: {},
  account: '0x0',

  CabinClass: {0:'Economy', 1:'Business', 2:'First'},
  SeatOccupiedStatus: {0:'Vacant', 1:'Occupied'},

  init: function () {
    return App.initWeb3();
  },


  initWeb3: function () {
    // Is there an injected web3 instance?
    if (typeof web3 !== 'undefined') {
      App.web3Provider = web3.currentProvider;
    } else {
      // If no injected web3 instance is detected, fall back to Ganache
      App.web3Provider = new Web3.providers.HttpProvider('http://localhost:8545');
    }
    appWeb3 = new Web3(App.web3Provider);
    return App.initContract();
  },


  initContract: function () {
    $.getJSON('FlightSeatsGlobalDistributor.json', function (flightSeatsDistributor) {
      // Get the necessary contract artifact file and instantiate it with truffle-contract
      var FlightSeatslDistributorArtifact = flightSeatsDistributor;
      App.contracts.FlightSeatslDistributor = TruffleContract(FlightSeatslDistributorArtifact);

      // Set the provider for our contract
      App.contracts.FlightSeatslDistributor.setProvider(App.web3Provider);

      // App.listenForEvents(); //TODO no listenForEventsFunction
      return App.render();
    });
    return App.bindEvents();
  },


  render: function () {
    var flightsInstance;

    $("#seatsRow").hide();
    $("#flightsRow").show();

    // Load account data
    appWeb3.eth.getCoinbase(function (err, account) {
      if (err === null) {
        App.account = account;
        $("#accountAddress").html("Your Account: " + account);
      }
    });

    // Load flights availability data
    App.contracts.FlightSeatslDistributor.deployed().then(function (instance) {
      flightsInstance = instance;
      return flightsInstance.getActiveAirlines.call();
    }).then(function (airlines) {
      return flightsInstance.getFlightIdsForAirline(airlines[0]).then(function (flightIds)
      {
        var flightsRow = $('#flightsRow');
        var flightsTemplate = $('#flightsTemplate');
        for (var i = 0; i < flightIds.length; i++) {
          flightsInstance.getFlight(flightIds[i]).then(function (flight) {
            flightsTemplate.find('.panel-title').text(appWeb3.toAscii("" + flight[1]));
            flightsTemplate.find('img').attr('src', ("images/" + appWeb3.toAscii("" + flight[6]) + ".jpg"));
            flightsTemplate.find('.flight-origin').text(appWeb3.toAscii("" + flight[2]));
            flightsTemplate.find('.flight-destination').text(appWeb3.toAscii("" + flight[3]));
            flightsTemplate.find('.flight-airline-name').text(flight[4]);
            flightsTemplate.find('.btn-book-flight').attr('data-id', flight[0]);
            flightsRow.append(flightsTemplate.html());
          });
        }
      });
    }).catch(function (error) {
      console.warn(error);
    });
  },


  bindEvents: function () {
    $(document).on('click', '.btn-book-flight', App.handleBookFlight);
    $(document).on('click', '.btn-book-seat', App.handleBookSeat);
    $(document).on('click', '.btn-checkin', App.initiateCheckin);
    $(document).on('click', '.btn-upload-ipfs', App.uploadToIPFS);
    $(document).on('click', '.btn-complete-checkin', App.generateBoardingPass);
  },


  handleBookFlight: function (event) {
    $("#flightsRow").hide();
    $("#seatsRow").show();
    event.preventDefault();
    var flightId = $(event.target).data('id');
    var flightsInstance;
    // Load flights availability data
    App.contracts.FlightSeatslDistributor.deployed().then(function (instance) {
      flightsInstance = instance;
      return flightsInstance.getSeatsForFlight(flightId);
    }).then(function (seatIds) {
      var seatsRow = $('#seatsRow');
      var seatsTemplate = $('#seatsTemplate');
      for (var i = 0; i < seatIds.length; i++) {
        flightsInstance.getSeat(seatIds[i]).then(function (seat) {
          let occupiedStatus = App.SeatOccupiedStatus[seat[3]];
          if (occupiedStatus === App.SeatOccupiedStatus[0]) {
            seatsTemplate.find('.panel-title').text(appWeb3.toAscii("" + seat[1]));
            seatsTemplate.find('img').attr('src', ("images/seat-" + App.CabinClass[seat[4]]) + ".jpeg");
            seatsTemplate.find('.seat-number').text(appWeb3.toAscii("" + seat[1]));
            seatsTemplate.find('.seat-price').text(seat[2]);
            seatsTemplate.find('.seat-status').text(App.SeatOccupiedStatus[seat[3]]);
            seatsTemplate.find('.seat-cabin').text(App.CabinClass[seat[4]]);
            var seatAndPrice = seat[0].toFixed() + "," + seat[2];
            seatsTemplate.find('.btn-book-seat').attr('data-id', seatAndPrice);
            seatsRow.append(seatsTemplate.html());
          }
        });
      }
    }).catch(function (error) {
      console.warn(error);
    });
  },


  handleBookSeat: function (event) {
    $("#loader").show();
    $("#seatsRow").hide();
    event.preventDefault();
    var seatIdAndPrice = $(event.target).data('id');
    var seatId = new BigNumber(seatIdAndPrice.split(",")[0]);
    var seatPrice = seatIdAndPrice.split(",")[1];
    var flightsInstance;
    // alert('seatId from event ' + seatId.toFixed() + ' price ' + seatPrice);
    App.listenForBookedSeatEvent(seatId);
    App.contracts.FlightSeatslDistributor.deployed().then(function (instance) {
      flightsInstance = instance;
      const transactionObject = {
        from: App.account,
        gas: 3000000,
        value: seatPrice
      };
      flightsInstance.contract.bookSeat(seatId.toFixed(), transactionObject, function(err, transactionHash) {
        if (!err) {
          console.log(transactionHash);
        }else {
          console.log(error);
          //TODO go back to book seat
        }
      });
    }).catch(function(err) {
      console.error(err);
      $("#loader").hide();
    });
  },


  listenForBookedSeatEvent: function(seatId) {
    App.contracts.FlightSeatslDistributor.deployed().then(function (instance) {
      instance.SeatBookedEvent({seatOwner: App.account, seatId: seatId}, {
        fromBlock: 0,
        toBlock: 'latest'
      }).watch(function(error, event) {
        if (!error) {
          $("#loader").hide();
          $("#bookingCompleteRow").show();
          var bookingCompleteRow = $('#bookingCompleteRow');
          var bookingCompleteTemplate = $('#bookingCompleteTemplate');
          // console.log(seatId);
          // console.log(seatId.toFixed());
          bookingCompleteTemplate.find('.seatId').text(event.args.seatId.toFixed());
          bookingCompleteTemplate.find('.flightNumber').text(appWeb3.toAscii("" + event.args.flightNumber));
          var departureDate = new Date();
          departureDate.setTime(event.args.departureDateTime * 1000);
          bookingCompleteTemplate.find('.departureDate').text(departureDate.toLocaleString("en-US"));
          bookingCompleteTemplate.find('.origin').text(appWeb3.toAscii("" + event.args.origin));
          bookingCompleteTemplate.find('.destination').text(appWeb3.toAscii("" + event.args.destination));
          bookingCompleteTemplate.find('.seatNumber').text(appWeb3.toAscii("" + event.args.seatNumber));
          bookingCompleteTemplate.find('.btn-checkin').attr('data-id', event.args.seatId.toFixed());
          bookingCompleteRow.append(bookingCompleteTemplate.html());
        } else {
          console.log(error); //TODO go back to book seat
        }
      });
    });
  },


  initiateCheckin: function (event) {
    $("#bookingCompleteRow").hide();
    $("#checkinRow").show();
    var seatId = $(event.target).data('id');
    var barcodeStringForBoardingPass = "";
    App.contracts.FlightSeatslDistributor.deployed().then(function (instance) {
      flightsInstance = instance;
      return flightsInstance.getBarcodeStringParametersForBoardingPass(seatId);
    }).then(function (params) {
      console.log(params[0]);
      console.log(params[1]);
      console.log(params[2]);
      console.log(params[3]);
      console.log(params[4]);
      console.log('params');
      console.log(seatId)
      barcodeStringForBoardingPass = appWeb3.toUtf8(params[0]) +
          appWeb3.toUtf8(params[1]).trim() +
          appWeb3.toUtf8(params[2]).trim() +
          params[3] +
          appWeb3.toUtf8(params[4]).trim();
      $("#checkinTemplate").find('.btn-complete-checkin').attr('data-id', (seatId + "," + barcodeStringForBoardingPass));
    }).catch(function (error) {
      console.warn(error);
    });
  },


  uploadToIPFS: function () {
    const reader = new FileReader();
    reader.onloadend = function () {
      const ipfs = window.IpfsApi('localhost', 5001) // Connect to IPFS
      const buf = buffer.Buffer(reader.result) // Convert data into buffer
      ipfs.files.add(buf, (err, result) => { // Upload buffer to IPFS
        if (err) {
          console.error(err)
          return
        }
        let url = `https://ipfs.io/ipfs/${result[0].hash}`
        console.log(`Url --> ${url}`)
        document.getElementById("output").src = url
        var seatIdAndBarcodeString = $("#checkinTemplate").find('.btn-complete-checkin').data('id');
        const seatIdAndIpfsURL = seatIdAndBarcodeString + "," + url;
        $("#checkinTemplate").find('.btn-complete-checkin').attr('data-id', seatIdAndIpfsURL);
        $("#fileUploadTemplate").hide();
        $("#completeCheckin").show();
      })
    }
    const photo = document.getElementById("photo");
    reader.readAsArrayBuffer(photo.files[0]); // Read Provided File
  },


  generateBoardingPass: function (event) {
    $("#checkinRow").hide();
    $("#loader").show();
    const boardingPassParams = $(event.target).attr('data-id');
    const seatId = boardingPassParams.split(",")[0];
    console.log('in generate');
    console.log(seatId);
    const barcodeString = boardingPassParams.split(",")[1];
    const ipfsUrl = boardingPassParams.split(",")[2];
    App.listenForBoardingPassGeneratedEvent(new BigNumber(seatId), barcodeString);
    App.contracts.FlightSeatslDistributor.deployed().then(function (instance) {
      flightsInstance = instance;
      const transactionObject = {
        from: App.account,
        gas: 3000000,
      };
      // alert('seatPrice is ' + seatPrice)
      flightsInstance.contract.checkinPassenger(seatId, barcodeString, ipfsUrl, transactionObject, function(err, boardingPassId) {
        if (!err) {
          console.log(boardingPassId);
        }else {
          console.log(error);
          //TODO go back to book seat
        }
      });
    }).catch(function (error) {
      console.warn(error);
      $("#loader").hide();
    });
  },


  listenForBoardingPassGeneratedEvent: function(seatId, barcodeString) {
    App.contracts.FlightSeatslDistributor.deployed().then(function (instance) {
      instance.BoardingPassGeneratedEvent({seatOwner: App.account, seatId: seatId}, {
        fromBlock: 0,
        toBlock: 'latest'
      }).watch(function(error, event) {
        if (!error) {
          $("#loader").hide();
          $("#BoardingPassRow").show();
          var boardingPassTemplate = $('#boardingPassTemplate');
          boardingPassTemplate.find('#barcode').attr('src', ("http://bwipjs-api.metafloor.com/?bcid=qrcode&text=" + barcodeString +"&includetext"));
          boardingPassTemplate.find('.barcodeString').text(barcodeString);
          boardingPassTemplate.find('.boardingPassId').text(event.args.boardingPassId.toFixed());
          boardingPassTemplate.find('.flightNumber').text(appWeb3.toAscii("" + event.args.flightNumber));
          var departureDate = new Date();
          departureDate.setTime(event.args.departureDateTime * 1000);
          boardingPassTemplate.find('.departureDate').text(departureDate.toLocaleString("en-US"));
          boardingPassTemplate.find('.origin').text(appWeb3.toAscii("" + event.args.origin));
          boardingPassTemplate.find('.destination').text(appWeb3.toAscii("" + event.args.destination));
          boardingPassTemplate.find('.seatNumber').text(appWeb3.toAscii("" + event.args.seatNumber));
          let passportScanIpfsUrl = appWeb3.toAscii("" + event.args.passportScanIpfsHash);
          alert('passportScanIpfsUrl ' + passportScanIpfsUrl );
          boardingPassTemplate.find('.passportScanIpfsUrl').html('<a href="' + passportScanIpfsUrl + '">'+passportScanIpfsUrl+'</a>');

          // boardingPassTemplate.find('#passportScanIpfsUrl').innerHTML = passportScanIpfsUrl;
          // boardingPassTemplate.find('#passportScanIpfsUrl').href = passportScanIpfsUrl;
        } else {
          console.log(error); //TODO go back to book seat
        }
      });
    });
  },


};


$(function () {
  $(window).load(function () {
    App.init();
  });
});
