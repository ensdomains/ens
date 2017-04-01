var assert = require('assert');
var async = require('async');
var fs = require('fs');
var Promise = require('bluebird');
var solc = require('solc');
var TestRPC = require('ethereumjs-testrpc');
var Web3 = require('web3');

var web3 = new Web3();
web3.setProvider(TestRPC.provider());

var ensCode = null;
var ensLLLCode = null;

function compileContract(filenames, sourceRoot) {
	if (!sourceRoot) {
		sourceRoot = './contracts/';
	}

	var sources = {};

	filenames.forEach((filename) => {
		sources[filename] = fs.readFileSync(sourceRoot + filename).toString();
	});

	var compiled = solc.compile({sources: sources}, 1);
	assert.equal(compiled.errors, undefined, compiled.errors);
	return compiled;
}

module.exports = {
	node: web3.sha3("0x0000000000000000000000000000000000000000000000000000000000000000" + web3.sha3('eth').slice(2), {encoding: 'hex'}),
	compileContract: compileContract,
	deployENS: function (account, done) {
		if(ensCode == null)
			ensCode = compileContract(['ENS.sol', 'AbstractENS.sol']).contracts['ENS.sol:ENS'];
		var ens = web3.eth.contract(JSON.parse(ensCode.interface)).new(
		    {
		    	from: account,
		     	data: ensCode.bytecode,
		     	gas: 4700000
		   	}, function(err, contract) {
		   	    assert.equal(err, null, err);
		   	    if(contract.address != undefined) {
		   	    	ens = Promise.promisifyAll(ens);
		   	    	done(null, ens);
			   	}
		   });
		return ens;
	},
	deployENSLLL: function(account, done) {
		if(ensLLLCode == null) {
			ensLLLCode = {
				bytecode: fs.readFileSync('./contracts/ENS.lll.bin').toString().trim(),
				interface: fs.readFileSync('abi/AbstractENS.abi').toString()
			}
		}
		return web3.eth.contract(JSON.parse(ensLLLCode.interface)).new(
		{
			from: account,
			data: ensLLLCode.bytecode,
			gas: 4700000
		}, function(err, contract) {
			assert.equal(err, null, err);
			if(contract.address != undefined) {
				done();
			}
		});
	},
	web3: web3,
	promisifyContractFactory: function(contractFactory) {
		contractFactory.newAsync = function() {
			var args = arguments;
			return new Promise(function(resolve, reject) {
				args[args.length] = function(err, contract) {
					if (err) {
						reject(err);
					} else if (typeof contract.address !== "undefined") {
						resolve(contract);
					} else {
						// There is to hope that reject or resolve is called
					}
				};
				args.length++;
				contractFactory.new.apply(contractFactory, args);
			});
		};
		return contractFactory;
	}
};
