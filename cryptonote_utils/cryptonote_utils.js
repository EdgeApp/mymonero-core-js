// Copyright (c) 2014-2018, MyMonero.com
//
// All rights reserved.
//
// Redistribution and use in source and binary forms, with or without modification, are
// permitted provided that the following conditions are met:
//
// 1. Redistributions of source code must retain the above copyright notice, this list of
//	conditions and the following disclaimer.
//
// 2. Redistributions in binary form must reproduce the above copyright notice, this list
//	of conditions and the following disclaimer in the documentation and/or other
//	materials provided with the distribution.
//
// 3. Neither the name of the copyright holder nor the names of its contributors may be
//	used to endorse or promote products derived from this software without specific
//	prior written permission.
//
// THIS SOFTWARE IS PROVIDED BY THE COPYRIGHT HOLDERS AND CONTRIBUTORS "AS IS" AND ANY
// EXPRESS OR IMPLIED WARRANTIES, INCLUDING, BUT NOT LIMITED TO, THE IMPLIED WARRANTIES OF
// MERCHANTABILITY AND FITNESS FOR A PARTICULAR PURPOSE ARE DISCLAIMED. IN NO EVENT SHALL
// THE COPYRIGHT HOLDER OR CONTRIBUTORS BE LIABLE FOR ANY DIRECT, INDIRECT, INCIDENTAL,
// SPECIAL, EXEMPLARY, OR CONSEQUENTIAL DAMAGES (INCLUDING, BUT NOT LIMITED TO,
// PROCUREMENT OF SUBSTITUTE GOODS OR SERVICES; LOSS OF USE, DATA, OR PROFITS; OR BUSINESS
// INTERRUPTION) HOWEVER CAUSED AND ON ANY THEORY OF LIABILITY, WHETHER IN CONTRACT,
// STRICT LIABILITY, OR TORT (INCLUDING NEGLIGENCE OR OTHERWISE) ARISING IN ANY WAY OUT OF
// THE USE OF THIS SOFTWARE, EVEN IF ADVISED OF THE POSSIBILITY OF SUCH DAMAGE.

// Original Author: Lucas Jones
// Modified to remove jQuery dep and support modular inclusion of deps by Paul Shapiro (2016)
// Modified to add RingCT support by luigi1111 (2017)
//
// v--- These should maybe be injected into a context and supplied to currencyConfig for future platforms
const JSBigInt = require("./biginteger").BigInteger;
const mnemonic = require("./mnemonic");
const nettype_utils = require("./nettype");

var cnUtil = function(currencyConfig) 
{
	const currency_amount_format_utils = require("../cryptonote_utils/money_format_utils")(currencyConfig)
	//
	this._CNCrypto = undefined; // undefined -> cause 'early' calls to CNCrypto to throw exception
	const ENVIRONMENT_IS_WEB = typeof window==="object";
	const ENVIRONMENT_IS_WORKER = typeof importScripts==="function";
	const ENVIRONMENT_IS_NODE = typeof process==="object" && process.browser !== true && typeof require==="function" && ENVIRONMENT_IS_WORKER == false; // we want this to be true for Electron but not for a WebView
	const ENVIRONMENT_IS_SHELL = !ENVIRONMENT_IS_WEB && !ENVIRONMENT_IS_NODE && !ENVIRONMENT_IS_WORKER;
	var _CNCrypto_template =
	{
		locateFile: function(filename, scriptDirectory)
		{
			if (currencyConfig["locateFile"]) {
				return currencyConfig["locateFile"](filename, scriptDirectory)
			}
			var this_scriptDirectory = scriptDirectory
			const lastChar = this_scriptDirectory.charAt(this_scriptDirectory.length - 1)
			if (lastChar == "/") { 
				this_scriptDirectory = this_scriptDirectory.substring(0, this_scriptDirectory.length - 1) // remove trailing "/"
			}
			const scriptDirectory_pathComponents = this_scriptDirectory.split("/")
			const lastPathComponent = scriptDirectory_pathComponents[scriptDirectory_pathComponents.length - 1]
			var pathTo_cryptonoteUtilsDir; // add trailing slash to this
			if (lastPathComponent == "cryptonote_utils") { // typical node or electron-main process
				pathTo_cryptonoteUtilsDir = scriptDirectory_pathComponents.join("/") + "/"
			} else if (ENVIRONMENT_IS_WEB) { // this will still match on electron-renderer, so the path must be patched up…
				if (typeof __dirname !== undefined && __dirname !== "/") { // looks like node running in browser.. assuming Electron-renderer
					// have to check != "/" b/c webpack (I think) replaces __dirname
					pathTo_cryptonoteUtilsDir = "file://" + __dirname + "/" // prepending "file://" because it's going to try to stream it
				} else { // actual web browser
					pathTo_cryptonoteUtilsDir = this_scriptDirectory + "/mymonero_core_js/cryptonote_utils/" // this works for the MyMonero browser build, and is quite general, at least
				}
			} else {
				throw "Undefined pathTo_cryptonoteUtilsDir. Please pass locateFile() to cryptonote_utils init."
			}
			const fullPath = pathTo_cryptonoteUtilsDir + filename
			//
			return fullPath
		}
	}
	// if (ENVIRONMENT_IS_WEB && ENVIRONMENT_IS_NODE) { // that means it's probably electron-renderer
	// 	const fs = require("fs");
	// 	const path = require("path");
	// 	const filepath = path.normalize(path.join(__dirname, "MyMoneroCoreCpp.wasm"));
	// 	const wasmBinary = fs.readFileSync(filepath)
	// 	console.log("wasmBinary", wasmBinary)
	// 	_CNCrypto_template["wasmBinary"] = wasmBinary
	// }
	this._CNCrypto = undefined;
	var loaded_CNCrypto = this.loaded_CNCrypto = function()
	{ // CAUTION: calling this method blocks until _CNCrypto is loaded
		if (typeof this._CNCrypto === 'undefined' || !this._CNCrypto) {
			throw "You must call OnceModuleReady to wait for _CNCrypto to be ready"
		}
		return this._CNCrypto;
	}
	this.moduleReadyFns = [] // initial (gets set to undefined once Module ready)
	this.OnceModuleReady = function(fn)
	{
		if (this._CNCrypto == null) {
			if (typeof this.moduleReadyFns == 'undefined' || !this.moduleReadyFns) {
				throw "Expected moduleReadyFns"
			}
			this.moduleReadyFns.push(fn)
		} else {
			fn(Module)
		}
	}
	require("./MyMoneroCoreCpp")(_CNCrypto_template).then(function(thisModule) 
	{
		this._CNCrypto = thisModule
		{
			for (let fn of this.moduleReadyFns) {
				fn(thisModule)
			}
		}
		this.moduleReadyFns = [] // flash/free
	});
	//
	function ret_val_boolstring_to_bool(boolstring)
	{
		if (typeof boolstring !== "string") {
			throw "ret_val_boolstring_to_bool expected string input"
		}
		if (boolstring === "true") {
			return true
		} else if (boolstring === "false") {
			return false
		}
		throw "ret_val_boolstring_to_bool given illegal input"
	}
	function api_safe_wordset_name(wordset_name)
	{
		return wordset_name.charAt(0).toUpperCase() + wordset_name.substr(1) // capitalizes first letter
	}
	//
	var config = {}; // shallow copy of initConfig
	for (var key in currencyConfig) {
		config[key] = currencyConfig[key];
	}


	// Generate a 256-bit / 64-char / 32-byte crypto random
	this.rand_32 = function() {
		return mnemonic.mn_random(256);
	};

	// Generate a 128-bit / 32-char / 16-byte crypto random
	this.rand_16 = function() {
		return mnemonic.mn_random(128);
	};

	// Generate a 64-bit / 16-char / 8-byte crypto random
	this.rand_8 = function() {
		return mnemonic.mn_random(64);
	};

	this.is_subaddress = function(addr, nettype) {
		const args =
		{
			address: addr,
			nettype_string: nettype_utils.nettype_to_API_string(nettype)
		};
		const args_str = JSON.stringify(args);
		const CNCrypto = loaded_CNCrypto();
		const ret_string = CNCrypto.is_subaddress(args_str);
		const ret = JSON.parse(ret_string);
		if (typeof ret.err_msg !== 'undefined' && ret.err_msg) {
			throw ret.err_msg // TODO: maybe return this somehow
		}
		return ret_val_boolstring_to_bool(ret.retVal);
	};

	this.is_integrated_address = function(addr, nettype) {
		const args =
		{
			address: addr,
			nettype_string: nettype_utils.nettype_to_API_string(nettype)
		};
		const args_str = JSON.stringify(args);
		const CNCrypto = loaded_CNCrypto();
		const ret_string = CNCrypto.is_integrated_address(args_str);
		const ret = JSON.parse(ret_string);
		if (typeof ret.err_msg !== 'undefined' && ret.err_msg) {
			throw ret.err_msg // TODO: maybe return this somehow
		}
		return ret_val_boolstring_to_bool(ret.retVal);
	};

	this.new_payment_id = function() {
		const args = {};
		const args_str = JSON.stringify(args);
		const CNCrypto = loaded_CNCrypto();
		const ret_string = CNCrypto.new_payment_id(args_str);
		const ret = JSON.parse(ret_string);
		if (typeof ret.err_msg !== 'undefined' && ret.err_msg) {
			throw ret.err_msg // TODO: maybe return this somehow
		}
		return ret.retVal;
	};

	this.new__int_addr_from_addr_and_short_pid = function(
		address,
		short_pid,
		nettype
	) {
		// throws
		if (!short_pid || short_pid.length != 16) {
			throw "expected valid short_pid";
		}
		const args =
		{
			address: address,
			short_pid: short_pid,
			nettype_string: nettype_utils.nettype_to_API_string(nettype)
		};
		const args_str = JSON.stringify(args);
		const CNCrypto = loaded_CNCrypto();
		const ret_string = CNCrypto.new_integrated_address(args_str);
		const ret = JSON.parse(ret_string);
		if (typeof ret.err_msg !== 'undefined' && ret.err_msg) {
			throw ret.err_msg // TODO: maybe return this somehow
		}
		return ret.retVal;
	};

	this.new_fake_address_for_rct_tx = function(nettype)
	{ // TODO: possibly support sending random_scalar from JS to emscripten to avoid emscripten random
		const args = { nettype_string: nettype_utils.nettype_to_API_string(nettype) };
		const args_str = JSON.stringify(args);
		const CNCrypto = loaded_CNCrypto();
		const ret_string = CNCrypto.new_fake_address_for_rct_tx(args_str);
		const ret = JSON.parse(ret_string);
		if (typeof ret.err_msg !== 'undefined' && ret.err_msg) {
			throw ret.err_msg // TODO: maybe return this somehow
		}
		return ret.retVal;
	};

	this.decode_address = function(address, nettype)
	{
		const args =
		{
			address: address,
			nettype_string: nettype_utils.nettype_to_API_string(nettype)
		};
		const args_str = JSON.stringify(args);
		const CNCrypto = loaded_CNCrypto();
		const ret_string = CNCrypto.decode_address(args_str);
		const ret = JSON.parse(ret_string);
		if (typeof ret.err_msg !== 'undefined' && ret.err_msg) {
			throw ret.err_msg // TODO: maybe return this somehow
		}
		return {
			spend: ret.pub_spendKey_string,
			view: ret.pub_viewKey_string,
			intPaymentId: ret.paymentID_string, // may be undefined
			isSubaddress: ret.isSubaddress
		}
	};

	this.newly_created_wallet = function(
		wordset_name,
		nettype
	) {
		const args =
		{
			wordset_name: api_safe_wordset_name(wordset_name),
			nettype_string: nettype_utils.nettype_to_API_string(nettype)
		};
		const args_str = JSON.stringify(args);
		const CNCrypto = loaded_CNCrypto();
		const ret_string = CNCrypto.newly_created_wallet(args_str);
		const ret = JSON.parse(ret_string);
		if (typeof ret.err_msg !== 'undefined' && ret.err_msg) {
			throw ret.err_msg // TODO: maybe return this somehow
		}
		return { // calling these out so as to provide a stable ret val interface
			mnemonic_string: ret.mnemonic_string,
			sec_seed_string: ret.sec_seed_string,
			address_string: ret.address_string,
			pub_viewKey_string: ret.pub_viewKey_string,
			sec_viewKey_string: ret.sec_viewKey_string,
			pub_spendKey_string: ret.pub_spendKey_string,
			sec_spendKey_string: ret.sec_spendKey_string
		};
	};

	this.are_equal_mnemonics = function(a, b) {
		const args =
		{
			a: a,
			b: b
		};
		const args_str = JSON.stringify(args);
		const CNCrypto = loaded_CNCrypto();
		const ret_string = CNCrypto.are_equal_mnemonics(args_str);
		const ret = JSON.parse(ret_string);
		if (typeof ret.err_msg !== 'undefined' && ret.err_msg) {
			throw ret.err_msg // TODO: maybe return this somehow
		}
		return ret_val_boolstring_to_bool(ret.retVal);
	}

	this.mnemonic_from_seed = function(
		seed_string,
		wordset_name
	) {
		const args =
		{
			seed_string: seed_string,
			wordset_name: api_safe_wordset_name(wordset_name)
		};
		const args_str = JSON.stringify(args);
		const CNCrypto = loaded_CNCrypto();
		const ret_string = CNCrypto.mnemonic_from_seed(args_str);
		const ret = JSON.parse(ret_string);
		if (typeof ret.err_msg !== 'undefined' && ret.err_msg) {
			throw ret.err_msg // TODO: maybe return this somehow
		}
		return ret.retVal;
	};

	this.seed_and_keys_from_mnemonic = function(
		mnemonic_string,
		nettype
	) {
		const args =
		{
			mnemonic_string: mnemonic_string,
			nettype_string: nettype_utils.nettype_to_API_string(nettype)
		};
		const args_str = JSON.stringify(args);
		const CNCrypto = loaded_CNCrypto();
		const ret_string = CNCrypto.seed_and_keys_from_mnemonic(args_str);
		const ret = JSON.parse(ret_string);
		if (typeof ret.err_msg !== 'undefined' && ret.err_msg) {
			throw ret.err_msg // TODO: maybe return this somehow
		}
		return { // calling these out so as to provide a stable ret val interface
			sec_seed_string: ret.sec_seed_string,
			address_string: ret.address_string,
			pub_viewKey_string: ret.pub_viewKey_string,
			sec_viewKey_string: ret.sec_viewKey_string,
			pub_spendKey_string: ret.pub_spendKey_string,
			sec_spendKey_string: ret.sec_spendKey_string
		};
	};

	this.validate_components_for_login = function(
		address_string,
		sec_viewKey_string,
		sec_spendKey_string,
		seed_string,
		nettype
	) {
		const args =
		{
			address_string: address_string,
			sec_viewKey_string: sec_viewKey_string,
			sec_spendKey_string: sec_spendKey_string,
			seed_string: seed_string,
			nettype_string: nettype_utils.nettype_to_API_string(nettype)
		};
		const args_str = JSON.stringify(args);
		const CNCrypto = loaded_CNCrypto();
		const ret_string = CNCrypto.validate_components_for_login(args_str);
		const ret = JSON.parse(ret_string);
		if (typeof ret.err_msg !== 'undefined' && ret.err_msg) {
			throw ret.err_msg // TODO: maybe return this somehow
		}
		return { // calling these out so as to provide a stable ret val interface
			isValid: ret_val_boolstring_to_bool(ret.isValid),
			isInViewOnlyMode: ret_val_boolstring_to_bool(ret.isInViewOnlyMode),
			pub_viewKey_string: ret.pub_viewKey_string,
			pub_spendKey_string: ret.pub_spendKey_string
		};
	};

	this.generate_key_image = function(
		tx_pub,
		view_sec,
		spend_pub,
		spend_sec,
		output_index
	) {
		if (tx_pub.length !== 64) {
			throw "Invalid tx_pub length";
		}
		if (view_sec.length !== 64) {
			throw "Invalid view_sec length";
		}
		if (spend_pub.length !== 64) {
			throw "Invalid spend_pub length";
		}
		if (spend_sec.length !== 64) {
			throw "Invalid spend_sec length";
		}
		const args =
		{
			sec_viewKey_string: view_sec,
			sec_spendKey_string: spend_sec,
			pub_spendKey_string: spend_pub,
			tx_pub_key: tx_pub,
			out_index: "" + output_index
		};
		const args_str = JSON.stringify(args);
		const CNCrypto = loaded_CNCrypto();
		const ret_string = CNCrypto.generate_key_image(args_str);
		const ret = JSON.parse(ret_string);
		if (typeof ret.err_msg !== 'undefined' && ret.err_msg) {
			throw ret.err_msg // TODO: maybe return this somehow
		}
		return ret.retVal;
	};

	this.create_signed_transaction__IPCsafe = function(
		pub_keys,
		sec_keys,
		serialized__dsts, // amounts are strings
		outputs,
		mix_outs,
		fake_outputs_count,
		serialized__fee_amount, // string amount
		payment_id,
		pid_encrypt,
		realDestViewKey,
		unlock_time,
		rct,
		nettype,
	) {
		const dsts = serialized__dsts.map(function(i) {
			i.amount = new JSBigInt(i.amount)
			return i
		})
		return this.create_signed_transaction(
			pub_keys,
			sec_keys,
			dsts,
			outputs,
			mix_outs,
			fake_outputs_count,
			new JSBigInt(serialized__fee_amount),
			payment_id,
			pid_encrypt,
			realDestViewKey,
			unlock_time,
			rct,
			nettype,
		);
	}

	this.create_signed_transaction = function(
		pub_keys,
		sec_keys,
		dsts,
		outputs,
		mix_outs,
		fake_outputs_count,
		fee_amount,
		payment_id,
		pid_encrypt,
		realDestViewKey,
		unlock_time,
		rct,
		nettype,
	) {
		unlock_time = unlock_time || 0;
		mix_outs = mix_outs || [];
		if (dsts.length === 0) {
			throw "Destinations empty";
		}
		if (mix_outs.length !== outputs.length && fake_outputs_count !== 0) {
			throw "Wrong number of mix outs provided (" +
				outputs.length +
				" outputs, " +
				mix_outs.length +
				" mix outs)";
		}
		for (i = 0; i < mix_outs.length; i++) {
			if ((mix_outs[i].outputs || []).length < fake_outputs_count) {
				throw "Not enough outputs to mix with";
			}
		}
	};

	function assert(stmt, val) {
		if (!stmt) {
			throw "assert failed" + (val !== undefined ? ": " + val : "");
		}
	}

	return this;
};
exports.cnUtil = cnUtil;
