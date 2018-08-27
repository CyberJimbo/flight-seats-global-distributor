# Installation Instructions

A local running IPFS instance is required, along with node version 9, npm version 6.2.0, ganache-cli, truffle, metamask. Virtual Box Ubuntu instance needs minimum 2048MB memory configured. 

Here are commands to setup from scratch on Virtual Box, skip tests as needed if your existing setup already includes

```sh
$ sudo apt-get update
```

# Install Node v9.0.0 and NPM v6.2.0 

```sh
$ sudo apt-get install nodejs
$ sudo apt-get install npm

$ node -v
$ npm -v

$ sudo npm install -g n
$ sudo n 9.0.0

$ sudo npm install -g npm@6.2.0
$ hash -r 

$ node -v
$ npm -v
```
(bash caches the path to original npm binaries, ``hash -r`` clears the cache, see here for description:  https://askubuntu.com/a/585401)

# Install git, truffle and ganache-cli 

```sh
$ sudo apt-get install git-core
$ sudo npm install -g truffle
$ sudo npm install -g ganache-cli
```

# IPFS, Install and run local instance  

Visit [dist.ipfs.io/#go-ipfs](https://dist.ipfs.io/#go-ipfs). Download the linux Binary amd64.

```sh
$ cd Downloads
$ tar xvfz go-ipfs_v0.4.17_linux-amd64.tar.gz
$ cd go-ipfs
$ sudo ./install.sh
$ ipfs init
$ ipfs config --json API.HTTPHeaders.Access-Control-Allow-Methods '["PUT", "GET", "POST", "OPTIONS"]'
$ ipfs config --json API.HTTPHeaders.Access-Control-Allow-Origin '["*"]'
$ ipfs daemon
```

# Clone this repo from github and build/run the project

```sh
$ git clone https://github.com/CyberJimbo/flight-seats-global-distributor.git
$ cd flight-seats-global-distributor
$ npm install
$ npm run build
$ npm run test
$ ganache-cli 
$ truffle migrate --reset --compile-all
$ npm run dev 
```

Install metamask plugin on Firefox.

*** SWITCH T0 2ND GANACHE ACCOUNT **** in METAMASK (1st account is used by contract owner to prepopulate a flight for the demo, this same account cannot be used to book seats and proceed through the UI flow)


