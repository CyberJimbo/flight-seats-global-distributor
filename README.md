# Flight Seats Global Distributor

The goal of this project is to re-imagine the flight booking, check-in and boarding pass processes, distributing flight-seats and boarding passes to passengers as ERC721 Non-Fungible Tokens.

The ERC721 standard is a standard for creating Non-Fungible Tokens (NFT). NFTs are cryptographic tokens stored on a blockchain which possess unique characteristics. Whereas ERC20 tokens like Ether (ETH) are fungible with respect to each individual unit being identical to every other unit - in contrast ERC721 NFT standard enables us to create digital bearer-instruments for cryptographic value-assets which have differentiating characteristics. This standard is perfectly suited to modelling value-assets like flight seats and boarding passes where each seat must have a unique seat number and where each boarding pass should be associated with a unique passenger.

# Rationale

The benefit of allowing the passenger to hold an ERC721 seat after booking is that it liberates the passenger to potentially sell, trade, swap, or give away their seat before check-in, should the passenger see fit. The ERC721 seat is a digital bearer-instrument belonging solely to the passenger. 

The use of ERC721 boarding passes enables us to increase the security of the boarding pass by adding a third security factor.
At check-in time the passenger who is in possession of the seat NFT submits identity documents to facilitate check-in. The airline subsequently burns the seat NFT and issues the passenger a new ERC721 boarding pass NFT. This boarding pass NFT is derived from the boarding pass' barcode string in combination with a hash of the identity documents, creating a crypto token which is uniquely tailored for this flight, seat and passenger identity. The passenger arriving at the airport needs to be in possession of the boarding pass, the correct passport, and the crypto token derived from these two constituents.

It is unlikely an airline would wish to distribute all flight-seats in this manner as it would create a possibility for seat-scalping. However airlines designate a subset of each flight's seats for 'flexible' fares, fares with a higher cost but with greater flexibility to cancel-booking, change dates and passenger names without incurring costs. ERC721 Seats are the ultimate flexible seat and airlines may wish to distribute a subset of flight seats in this manner.

Furthermore, airlines are beholden to the big legacy Global Distribution System providers to distribute their own seat inventory (Sabre, Amadeus, Travelport), resulting in notoriously low profit margins for airlines. Opening up an additional decentralised direct-to-consumer channel for airlines could help to disintermediate these middle-men organisations. 

# This Project 

This project is a proof-of-concept implementation for a decentralised airline Global Distribution System (GDS). It allows airlines to create flights and populate the flights with seat inventory. It allows passengers to book this seat inventory and receive ERC721 seat NFTs. It allows passengers to check in for the flight by submitting identity documents via IPFS in order to receive an ERC721 boarding pass NFTs. A complete list of use cases are described below:

# Airline Use-Cases

1. Create Flight. Airlines supply flight-itinerary information to initiate a flight in contract storage.

2. Add Seat Inventory. Airlines supply seat numbers and corresponding seat prices for each cabin in the flight.

3. Withdraw Flight Fees. Airlines can withdraw their fees from passengers' seat bookings via a pull-based payments/withdraw system.

4. Cancel Seat Bookings. Airline can cancel a passenger's seat booking which repossesses their ERC721 seat and triggers a refund to be queued for the passenger.

5. Process Refunds. Airline can process the refunds queue to trigger payouts to passengers who are owed refunds from seat cancellations.

# Passenger Use-Cases

6. Book Seat. Passengers can book available flight seats and receive ERC721 seats for their booking.

7. Check-In. Passengers can check-in for flights which returns their ERC721 seat to the airline. The ERC721 seat is subsequently burned by the airline. The passenger supplies a IPFS hash for their passport-scan image in this check-in operation. When check-in succeeds the passenger receives back another ERC721 token for their boarding pass which is uniquely associated with their IPFS passport-scan hash.

8. Cancel Seat Bookings. Passengers can also cancel their seat booking, which returns their ERC721 Seat to the airline and triggers a refund to be queued for the passenger.

# Demo Instructions

Please note only the passenger use-cases of book-seat and checkin are available to demo via a lite-server UI layer. A web interface for allowing airlines to create flights and populate seat inventory was beyond scope given deadline-constraints. However the airline create-flight/populate seat-inventory operations are invoked in the contract's constructor to provide the passenger booking UI flow with a flight to choose and seats to book. Additionally, every airline use-case is extensively unit-tested to validate expected functionality.

Please see [installation instructions](installation_instructions.md) which details demo pre-requisites and how to setup from scratch on VirtualBox Ubuntu. A local running IPFS instance is required, along with node version 9, npm version 6.2.0, ganache-cli, truffle, metamask. A minimum of 2018 MB memory is required on the VirtualBox Ubuntu instance. 

Assuming [installation instructions](installation_instructions.md) and prerequisites are met, proceed as follows:

```sh
$ npm install 
$ npm run build
$ npm run test
$ ganache-cli
$ ipfs daemon
$ truffle migrate --reset --compile-all
$ npm run dev 
```

The final command ``npm run dev`` will start a locally running lite-server instance which will serve the flight booking, checkin and boarding pass UI flows to interact with the contract deployed on local ganache network. 

# Steps to demo

First log into metamask using the same seed phrase from your local running ganache-cli instance. Then switch to another of the ganache accounts in metamask instead of the default account, you can do this by selecting 'create account' in metamask which switches to another available ganache account. The default account is used by the contract owner to prepopulate a single flight and airline belonging to this account for demo purposes, and you cannot proceed through the flight booking and checkin flows using the same default account

  - First screen shows a single flight pre-populated from the contract's constructor. Select book flight.
  - Select a seat (confirm transaction in metamask for cost of seat)
  - View Seat booking with ERC721 Token ID
  - For demo purposes immediately proceed to checkin. Select Check In For Flight
  - Choose an image file on your local machine to submit to IPFS as your passport-scan, can be any image for demo. Choose file and then select Upload Passport to IPFS
  - Select Complete Checkin (confirm transaction in metamask for zero cost)
  - View your boarding pass, complete with 2D QRCode, ERC721 Boarding Pass ID and link to passport-scan image in IPFS.
  
Please note that currently Metamask does not yet support the ERC721 standard, so you cannot view these tokens in metamask. You can verify in truffle console that your address is the owner of the ERC721 tokens by invoking the ownerOf() function in the contract and supplying the token ID. Additionally the unit tests are verifying that the correct passenger owns the ERC721 tokens after booking and checkin.

