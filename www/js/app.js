"use strict";
/* globals TTS,$ */
/* exported setMicInactive,setMicOff,connect,startButton,arrowUp,arrowDown,arrowRight,arrowLeft,stopButton,mute,toggleWakeup,toggleSimulator,toggleUnrecognized,toggleDropdown*/
document.addEventListener("deviceready", initialize, false);

var connected=false;
var recognizing = false;
//    var recognition;
var total_recognized = 0;
//  var noRestartReco;
var startTimestamp;
var ros;						// this will be the connection to Ros
var topicName = '/cmd_vel';     					// topic name for the UR robots
//	var topicName = '/cmd_vel_mux/input/navi';     		// topic name for the Stage simulator
//	var topicName = '/turtle1/cmd_vel'; 	    		// this allows testing with turtlesim
var speedFactor = 1.0;								// multiplies or divides speed to go faster or slower
var linearSpeed = 0.2, angularSpeed = 0.4;			// initial speed
var linearRepeat = 25, angularRepeat = 25;			// number of times to repeat command
var repeatInterval = 200;							// wait time between repeats, in ms
var stopMotion = true;
var robotUrl;
var muted = false;
var wakeup = ["robot", "loki", "magni"];
var useWakeup = false;
var showUnrecognized = false;
var infoMsg;
var useSimulator = false;
var mic, micSlash, micBg;
	

function setMicInactive() {
	micBg.style.color = "Gray";
	micSlash.style.display = "none";
}
function setMicActive() {
	micBg.style.color= "#00BBA1"; 	//"#00cc00";    // green
	micSlash.style.display = "none";
}
function setMicOff() {
	micBg.style.color = "Gray";
	micSlash.style.display = "inline";
}
function addLog(text, textColor) {
	var table = document.getElementById ("commandLog");
	var row = table.insertRow(0);
	var cell1 = row.insertCell(0);
	if (textColor) {
		cell1.style.color = "red";
	}
	cell1.innerHTML = text;
}
	/**
	* Set up GUI elements when the page is loaded.
	*/
function initialize() {
	var temp;
	micBg = document.getElementById("mic-bg");
	mic =   document.getElementById("mic");
	micSlash = document.getElementById("mic-slash");
	if (localStorage.firstResultOK === undefined) {
		localStorage.firstResultOK = 0;
	}
	if (localStorage.otherResultOK === undefined) {
		localStorage.otherResultOK = 0;
	}
	if (localStorage.robotUrl !== undefined) {
		temp = localStorage.robotUrl;		// use the last robot address
	} else {
		temp = "wss://" + location.hostname + ":9090";  //guess at it
	}
	document.getElementById("robotUrlEntry").value = temp;
//		if (window.SpeechSynthesisUtterance === undefined) {
//			muted = true;
//		}
	infoMsg = document.getElementById ("infoMsg");
//		showInfo ("");

	document.getElementById("wakeupButton").innerHTML = "Wakeup word isn't required";

	checkPermissions ();

		//--------------------Permissions-------------------------
	function checkPermissions() {
		var permissionRequests = [];
		cordova.plugins.diagnostic.getPermissionsAuthorizationStatus(function(statuses){
			for (var permission in statuses){
				switch(statuses[permission]){
					case cordova.plugins.diagnostic.permissionStatus.GRANTED:
						console.log("Permission previously granted to use " + permission);
						break;
					case cordova.plugins.diagnostic.permissionStatus.NOT_REQUESTED:
						permissionRequests.push (permission);
						console.log("Permission to use "+permission+" has not been requested yet");
						break;
					case cordova.plugins.diagnostic.permissionStatus.DENIED:
						console.log("Permission previously denied to use "+permission+" - will ask again.");
						permissionRequests.push (permission);
						break;
					case cordova.plugins.diagnostic.permissionStatus.DENIED_ALWAYS:
						console.log("Permission has been permanently denied to use " + permission);
						break;
				}
			}
			askPermissions (permissionRequests);
		},  function (error) {
				alert (error);
		},[
			cordova.plugins.diagnostic.permission.RECORD_AUDIO
		]);
	}
	function askPermissions (permissionRequests) {
		if (permissionRequests.length > 0) {
			cordova.plugins.diagnostic.requestRuntimePermissions(function(statuses){
				for (var permission in statuses){
					switch(statuses[permission]){
						case cordova.plugins.diagnostic.permissionStatus.GRANTED:
							console.log("Permission granted to use "+permission);
							break;
						case cordova.plugins.diagnostic.permissionStatus.NOT_REQUESTED:
							console.log("Permission to use "+permission+" has not been requested yet");
							break;
						case cordova.plugins.diagnostic.permissionStatus.DENIED:
							console.log("Permission to use "+permission+" denied.");
							break;
						case cordova.plugins.diagnostic.permissionStatus.DENIED_ALWAYS:
							console.log("Permission permanently denied to use " + permission + "!");
							break;
					}
				}
			}, function (error){
					alert (error);
			},
			permissionRequests);
		} 
	}
}	


function say (words) {
	var wasRecognizing = false;
//		var stowabool;
	if (muted === false) {
//			stowabool = noRestartReco;
		if (recognizing) { 
			wasRecognizing = true;
//				noRestartReco = true;   //test
			//recognition.stop (); 
		}
		TTS.speak (words, function () {
			//if (wasRecognizing) { 
				//recognition.start ();
			//}
//				noRestartReco = stowabool;
//			console.log ('TTS success');
		}, function (reason) {
			console.log ("TTS failed, " + reason);
		});
		
		/*-------------------
		var u = new SpeechSynthesisUtterance();
		u.text = words;
		u.lang = 'en-US';
		u.rate = 1.1;
		u.pitch = 1.0;
		u.default = true;
		u.localService = true; 
		u.onend = function(event) { 
			if (wasRecognizing) { 
				//recognition.start ();
			}
			noRestartReco = stowabool;
		}
		speechSynthesis.speak(u);---------*/
	}
}

function rosConnect(robotUrl) {
	ros = new ROSLIB.Ros({						// Connecting to ROS.
		url: robotUrl 							
	});
//	ros.socket.addEventListener("onopen", onConnection());
//	ros.socket.addEventListener("onerror", onError());
//	ros.socket.addEventListener("onclose", onClose());
	
	ros.on('connection', function() {
	
		var connectButton;
			console.log ('Connected to websocket server.');
			localStorage.robotUrl = robotUrl;
			connectButton = document.getElementById("connectButton");
			connectButton.innerHTML = "Disconnect";
			connectButton.style.background="#00cc00";    		// green
			say ('connected');
			connected = true;
		});
		
		ros.on('error', function(error) {
		console.log (error);
		 say ('Darn. We failed to connect.');
		 //none of the following work... 
		 //alert (error.stack);
		 //alert (error.message);
		 //alert (JSON.stringify(error));
		 bootbox.alert ('Error connecting to websocket server. ' + error);
	});

	ros.on('close', function() {
	var connectButton;	
		if (connected) {			// throw away a second call
			connected = false;
			connectButton = document.getElementById("connectButton");
			connectButton.style.background = "#006dcc";    
			connectButton.innerHTML = "Connect";
			say ('connection closed');   
			console.log('Connection to websocket server closed.');
		}
	});
}

function connect () {
	var connectButton, locaddr, prefix, port;
	if (connected) {			// disconnect
		ros.close();
	} else {
		robotUrl = document.getElementById("robotUrlEntry").value.trim();
		if (robotUrl === '') {
			bootbox.alert ("Please supply the robot's URL and port");
			return;
		} 
		//robotUrl = "ws://10.0.0.21:9090"		// testing
		//robotUrl = "ws://george.local:9090"	//testing
		robotUrl = robotUrl.replace("https:", "wss:");
		robotUrl = robotUrl.replace("http:", "ws:");
		if ((robotUrl.slice (0,5) != "wss://") && (robotUrl.slice (0,4) != "ws://") &&
				(robotUrl.charAt(robotUrl.length - 5) != ":")) {
			bootbox.alert 
				("The robot's URL should begin with http, https, ws, or wss, " + 
					"and end with a port number, like ':9090'.");
			return;
		}
		locaddr = robotUrl.substr(0, robotUrl.length-5);		// get rid of port
		port = robotUrl.substr(robotUrl.length-5, 5);
		if (locaddr.startsWith ("ws://")) {
			locaddr = locaddr.replace ("ws://", "");
			prefix = "ws://";
		} else if (locaddr.startsWith ("wss://")) {
			locaddr = locaddr.replace ("wss://", "");
			prefix = "wss://";
		}
		if (locaddr.endsWith (".local")) {
			connectLocal (locaddr);
		} else {
			console.log ("connecting to IP " + robotUrl);
			rosConnect (robotUrl);
		}
	}
	
	function connectLocal (localName) {
		console.log ("Find address for " + localName ); 
		var host = localName;
		var multicastIP = "224.0.0.251";
		var multicastPort = "5353";
		var address = "";
		multicastDNS.query (host, multicastIP, multicastPort,  function (result) { 
			address = prefix + result + port;
			robotUrl = address;
			console.log ("local address found, connecting to " + address);
			rosConnect (address);
			},
			function (reason) {
				console.log ("Zeroconf error: " + reason);
			}
		);
		// if the local name doesn't exist there will not be a response, so we need to time out
		setTimeout (function(){
			if ((address == "") || (address == undefined)) {
				say (host + " was not found");
			}
		}, 2000); 
	}
}
/*
//	ros.on('connection', function() {
	function onConnection () {
		var connectButton;
			console.log ('Connected to websocket server.');
			localStorage.robotUrl = robotUrl;
			connectButton = document.getElementById("connectButton");
			connectButton.innerHTML = "Disconnect";
			connectButton.style.background="#00cc00";    		// green
			say ('connected');
			connected = true;
		}

//	ros.on('error', function(error) {
		function onError (error) {
		console.log (error);
		 say ('Darn. We failed to connect.');
		 //none of the following work... 
		 //alert (error.stack);
		 //alert (error.message);
		 //alert (JSON.stringify(error));
		 bootbox.alert ('Error connecting to websocket server. ' + error);
	}

//	ros.on('close', function() {
	function onClose () {	
		var connectButton;	
		if (connected) {			// throw away a second call
			connected = false;
			connectButton = document.getElementById("connectButton");
			connectButton.style.background = "#006dcc";    
			connectButton.innerHTML = "Connect";
			say ('connection closed');   
			console.log('Connection to websocket server closed.');
		}
	}
*/

function startRecognition () {
		
    window.plugins.speechRecognition.startListening (
		recogSuccess, 
		recogError, 
		{language: "en-US",
		 matches: 10,
		 prompt: "Listening",
		 showPopup: true,
		 showPartial: false
		});
	recognizing = true;
	//showInfo('info_speak_now');
	console.log('onstart');
	setMicActive ();
	
    
	function recogSuccess (results) {
		console.log ("recognition onresult, length " + results.length);
		recognizing = false;
		if (results.length > 0) {
           recogOnresult (results);
		// } else {
			// nothing heard
		}
	}
	
	function recogError (err){
		console.log("recognition error: " + JSON.stringify (err));
		recognizing = false;
		
		if (err == "0") {
			//setMicInactive ();
			showInfo("No speech was heard");
			//noRestartReco = false;
		} else {
			bootbox.alert ("recognition error: " + JSON.stringify (err));
		}
		// prompt ("No speech was heard. On retry, speak without delay.");
	}
	
	/*----------------------------------------------------
	recognition.onend = function() {
		console.log('onend; ' + (noRestartReco ? "dont restart" : "do restart"));
		recognizing = false;
		if (noRestartReco) {
			return;
		}
		showInfo('');
		restartReco();
	}-------------------------------*/

	function recogOnresult (results) {
		console.log('recognition.onresult');
		
		function getDistance (quantity, what) {
			var howmany;
			howmany = Number(quantity);
			if (isNaN(howmany)) {
				if (quantity == "to" || quantity == "too") {
					howmany = 2;
				} else if (quantity == "for") {
					howmany = 4;
				} else {
					return 0;
				}
			}
			if (what == "meters" || what == "meter") {
				return (howmany);
			} else if (what == "centimeters" || what == "centimeter") {
				return howmany * 0.01;	
			} else if (what == "feet" || what == "foot") {
				return howmany * 0.3048;			// converts feet to meters
			} else if (what == "degrees" || what == "degree") {
				return howmany * Math.PI / 180;		// convert to radians
			} else {
				return 0;
			}	
		}
		
		var commands = '';
		var x = 0, y = 0, z = 0; 		// linear x and y movement and angular z movement
		var commandFound = false;
		// var result;
		var candidate, topCandidate = "";		
		var allResults = "";
		var dist = 0;
		var altNumber;		
		
		//	if (recognition.continuous == true)	{recognition.stop ()}	
									
		testAllCandidates:
		for (var i = 0; i < results.length; ++i) {
			candidate = results[i].toLowerCase().trim();
			var words = candidate.match(/[-\w]+/g); 				// parses candidate to array of words
			if (useWakeup) {
				if (wakeup.indexOf (words[0]) >= 0) {			// if the first word is a wakeup word 
					words.splice (0,1);							// remove it
					if (i == 0) {
						topCandidate = words.join(' ');	
					}
				} else {
					continue;
				}
			}
			if (words.length >= 2) {
				if (words[0] == 'go' && words[1] != 'to' && words[1] != 'home') {
					words.splice (0,1);		// remove superfluous "go"
				}
			}
			commandFound = true;
			testCandidate: switch (words [0]){
				case 'forward':
				case 'foreword':
				case 'keep going':
				case 'ahead':
				case 'straight':
				case 'go':
					if (words.length == 1) {			
						x = linearSpeed;
						sendTwistMessage (x, z);
					} else if (words.length == 3) {
						dist = getDistance (words[1], words[2]);			// accept meters, translate feet --> meters
						commandFound = (dist > 0);
						if (dist > 0) {
							moveRobotFromPose (dist, 0);		// move dist meters 
						}
					} else {
						commandFound = false;
					}
					break testCandidate;
				case "reverse":
				case "backward":
				case "back":
					if (words.length == 1) {			
						x = -linearSpeed;
						sendTwistMessage (x, z);
					} else if (words.length == 3) {
						dist = -getDistance (words[1], words[2]);			// accept meters, feet --> meter
						commandFound = (dist < 0);
						if (dist < 0) {
							moveRobotFromPose (dist, 0);		// move dist meters 
						}
					} else {commandFound = false;
					}
					break testCandidate;
				case "rotate":
					if (words.length == 2 ) {		
						dist = angularSpeed;
					} else if (words.length == 4) {
						dist = getDistance (words[2], words[3]);			// accept number of degrees
					} else {
						commandFound = false;
						break testCandidate;
					}
					if (dist <= 0) {
						commandFound = false;
						break testCandidate;
					} 
					rotswitch: switch (words [1]) {
						case "right":
							//z = -dist;
							moveRobotFromPose (0, -dist);	
							break rotswitch;
						case "left":
							moveRobotFromPose (0, dist);
							//z = dist;
							break rotswitch;
						default:
							commandFound = false;
							break testCandidate;
					}
					// sendTwistMessage (x, z);
					break testCandidate;
					
				case "turn":
					turnswitch: switch (words [1]) {
						case "right":
							z = -angularSpeed;
							break turnswitch;
						case "left":
							z = angularSpeed;
							break turnswitch;
						default:
							commandFound = false;
							break testCandidate;
					}
					x = linearSpeed;
					sendTwistMessage (x, z);
					break testCandidate;
				case "stop":
				case "halt":
					stopMotion = true;
					//sendTwistMessage (0, 0);
					break testCandidate;
				case "faster":
					speedFactor *= 1.1;
					//speed_span.innerHTML = "Speed factor " + speedFactor.toFixed(2); 
					break testCandidate;
				case "speed":
					if (words [1] == "up") {
						speedFactor *= 1.1;
					//	speed_span.innerHTML = "Speed factor " + speedFactor.toFixed(2); 
					} else {
						commandFound = false;
					}
					break testCandidate;
				case "slower":
					speedFactor /= 1.1;
					//speed_span.innerHTML = "Speed factor " + speedFactor.toFixed(2); 
					break testCandidate;
				case "slow":
					if (words [1] == "down") { 
						speedFactor /= 1.1;
					//	speed_span.innerHTML = "Speed factor " + speedFactor.toFixed(2); 
					} else {
						commandFound = false;
					}
					break testCandidate;
				case "help":
					$('#helpModal').modal('show');
					break testAllCandidates;
				default: 
					commandFound = false;
					break testCandidate;
			}

		// it may yet be a waypoint command
			if (!commandFound) {
				if (words && words.length > 1) {
					if (words [0] == "waypoint") {			// it is a waypoint command, to set a waypoint
						commandFound = true;				// prevent the error msg
						var waypoint = words.slice(1).join(" ");
						bootbox.dialog({
						  message: waypoint,
						  className: "bootbox-msg",
						  title: "Please confirm the waypoint name ",
						  closeButton: false,
						  buttons: {
							danger: {
							  label: "No",
							  className: "btn-danger",
							  callback: function() {
							  }
							},
							success: {
							  label: "OK",
							  className: "btn-success",
							  callback: function() {
								setWaypoint (waypoint);
							  }
							}
						  }
						});

					} else if (words.length > 2 && words[0] == "go" && words[1] == "to") {		// go to waypoint
						commandFound = true;
						goToWaypoint (words.slice(2).join(" "));
					} else if (words.length > 2 && words[0] == "remove" && words[1] == "waypoint") { 	// remove waypoint
						commandFound = true;
						SetWaypointZero (words.slice(2).join(" "));
					} else if (words.length == 2 && words[0] == "list" && words[1] == "waypoints") { 	// list the waypoints
						commandFound = true;
						listWaypoints ();
					} else if (words.length == 2 && words[0] == "go" && words[1] == "home") {	// go home 
						commandFound = true;
						goToWaypoint ("home");
					}
				}
			}
		allResults += "/" + candidate;
		if (commandFound === true) {
			altNumber = i;
			break testAllCandidates;
		}
	}		// end of for loop
		
	console.log (allResults);
	if (showUnrecognized) {addLog (allResults);}
	if (commandFound) {								// publish the command
		commands = candidate + " (alt. #" + (altNumber + 1) + " of " + results.length + ") " + commands;
		commands = commands.slice (0, 50);
		//final_span.innerHTML = "Commands ["+ total_recognized + "]: "  + commands;
		//cmd_err_span.innerHTML = "";
		total_recognized++;
		addLog (commands);
		
	// Research: Keep count of how often we used the first result
		if (altNumber == 0) {
			localStorage.firstResultOK = Number(localStorage.firstResultOK) + 1;
		} else {
			localStorage.otherResultOK = Number(localStorage.otherResultOK) + 1;
		} 
		console.log ("First answer recognition rate is " + ((100 * Number(localStorage.firstResultOK)) /
			(Number(localStorage.firstResultOK) + Number(localStorage.otherResultOK))).toFixed(2) + "%");
	} else if (topCandidate != "") {
			addLog (topCandidate.toLowerCase() + " is not recognized as a command", "red");
		}
	}	// end of recogOnresult
}   // end of function startRecognition
			
/*
	
        var teleop = new KEYBOARDTELEOP.Teleop({
            ros: ros,
            topic: '/base_controller/command'
        });

        // Create a UI slider using JQuery UI.
        $('#speed-slider').slider({
            range: 'min',
            min: 0,
            max: 100,
            value: 90,
            slide: function(event, ui) {
                // Change the speed label.
                $('#speed-label').html('Speed: ' + ui.value + '%');
                // Scale the speed.
                teleop.scale = (ui.value / 100.0);
            }
        });
        // Set the initial speed .
        $('#speed-label').html('Speed: ' + ($('#speed-slider').slider('value')) + '%');
        teleop.scale = ($('#speed-slider').slider('value') / 100.0);
        }
*/

function showInfo (s) {
	infoMsg.innerHTML = s;
/*	if (s) {
		for (var child = info.firstChild; child; child = child.nextSibling) {
			if (child.style) {
				child.style.display = child.id == s ? 'inline' : 'none';
			}
		}
		info.style.visibility = 'visible';
	} else {
		info.style.visibility = 'hidden';
	}*/
}

function startButton(event) {
	console.log ('startButton event');
	if (recognizing) {
		//noRestartReco = true;
		//setMicInactive()
		showInfo ("");
		return;
	} else {
		//recognition.lang = "en-US";
		//noRestartReco = false;
		//setMicOff ()
		showInfo ("");
		startTimestamp = event.timeStamp;
		startRecognition ();
	}
}
/*-------------------------
        function restartReco() {
	    	console.log('restart recognition');
 //           recognition.start();
            noRestartReco = false;
			recognizing = true;
			setMicActive ();
			startRecognition ();
        }
-----------------------*/
 //        var current_style;
 //
 //       function showButtons(style) {
 //           if (style == current_style) {
 //               return;
 //           }
 //           current_style = style;
 //           copy_button.style.display = style;
 //           email_button.style.display = style;
 //           copy_info.style.display = 'none';
 //           email_info.style.display = 'none';
 //       }

		function sendTwistMessage(xMove, zMove) {
			console.log ("sending twist x:" + xMove + " z:" + zMove);
		// linear x and y movement and angular z movement
			
			var cmdVel = new ROSLIB.Topic({
				ros : ros,
				name : topicName,
				messageType : 'geometry_msgs/Twist'
			});
	
			var twist = new ROSLIB.Message({
				linear: {
					x: xMove*speedFactor,
					y: 0.0,
					z: 0.0
				},
				angular: {
					x: 0.0,
					y: 0.0,
					z: zMove*speedFactor
				}
			});
			var reps = Math.max (1, Math.abs (twist.linear.x) > 0 ? linearRepeat : (Math.abs (twist.angular.z) > 0 ? angularRepeat : 1));
			if (typeof cmdVel.ros != "undefined") {			// this would be if we are not connected
				stopMotion = false;
				publishCmd ();
			}
			function publishCmd() {
				if (!stopMotion) {
					cmdVel.publish (twist);
					if (reps > 1) {
						setTimeout (publishCmd, repeatInterval);
						reps = reps - 1;
					}
				}
			}
		}
		
		function arrowUpGo () {
			sendTwistMessage (linearSpeed, 0.0);
			addLog ("forward button");
		}
		function arrowDownGo () {
			sendTwistMessage (-linearSpeed, 0.0);
			addLog ("back button");
		}
		function arrowRightGo () {
			sendTwistMessage (0.0, -angularSpeed);
			addLog ("rotate right button");
		}
		function arrowLeftGo () {
			sendTwistMessage (0.0, angularSpeed);
			addLog ("rotate left button");
		}
		function stopButton () {
			stopMotion = true;
			addLog ("stop button");
			//sendTwistMessage (0.0, 0.0);
		}
		function arrowMotionStop () {
			stopMotion = true;
		}
		
	  // ----------------------------------------------------------------------
      // Waypoints
	  // Waypoints are stored as parameters using the rosparam functions.   They are <name value> pairs--both strings.
	  // The values are obtained by stringify from the location--that is, the robot pose.
	  // A value of 0 indicates that the waypoint has been removed.
	  // ----------------------------------------------------------------------
      
      // ----------------------------------------------------------------------
      // Get the value of a waypoint parameter
	  // -----------------------------------------------
	  
		function getWaypointValue(paramname) {
			return new Promise (function(resolve, reject) {
				var waypoint = new ROSLIB.Param({
					ros : ros,
					name : '' 
				});
				waypoint.name = paramname;
				waypoint.get (function(value) {
					if  (value !== "0") {
						resolve (paramname);		// it is an undeleted waypoint 
						// console.log (paramname + " has a value"); 
						}
					else {
						resolve ("0");		// it is an undeleted waypoint 
						// console.log (paramname + " has no value");
					}
				});
			});	
		}
		
	  // ----------------------------------------------------------------------
      // List the waypoints
      // ----------------------------------------------------------------------		
		
		function listWaypoints () {
			if (connected) {
				var count = 0;
				var output = "";
				var promises = [];
				/*var waypoint = new ROSLIB.Param({
					ros : ros,
					name : '' 
				}); */
			
				ros.getParams(function(params) {				// first get the list of ROS params
					// console.log("Params: " + params);
					if (params.length == 0) {
						say ("No parameters were found, let alone waypoints.");
					} else {											// look at all the params
						for (var i = 0; i < params.length; i++) {		// for each one: if a waypoint, get the value
							if (params[i].search ("/waypoint/") == 0) {			// "/waypoint/" is found at string [0]
							   promises.push(getWaypointValue(params[i]));
							   count++;
							}
						}
						if (count == 0) {
							say ("No waypoints were found");
						} else {
							Promise.all(promises).then(function(waypoints) {
								var counter = 0;
								waypoints.forEach(function(data) {
									if (data != "0") {			// this would indicate a waypoint that has been removed
										counter++;
										output = output + ", " + data.substring(10);
									}
								});
								if (counter == 0) {
									say ("No waypoints were found");
								} else if (counter == 1) {
									say ("The only waypoint is " + output);
								} else {
									say ("The waypoints are " + output);
								}
							}).catch(function(err){
								console.log(err);
							});
						}	
					}
				});
			}
		}			

		function goToWaypoint (waypointName) {
			var waypointPose;
			if (connected) {
				var waypoint = new ROSLIB.Param({
				ros : ros,
				name : '' 
				});
				waypoint.name = "waypoint/" + waypointName;
				waypoint.get(function(value) {
					if  (!value) {
						say ('Waypoint ' + waypointName + ' was not found');
						// alert ('Waypoint ' + waypointName + ' was not found');
						}
					else {
						console.log('Value of waypoint ' + waypointName + ': ' + value);
						if (value == "0") {
							say ('Waypoint ' + waypointName + ' has been removed');
						} else {
							value = value.replace ('translation', 'position');		// convert tf pose to geometry
							value = value.replace ('rotation', 'orientation');
							waypointPose = JSON.parse(value);
							moveRobotToPose (waypointPose);
						}
					}
				});
			}
		}
		
		function setWaypoint (waypointName) {
	  // ----------------------------------------------------------------------
      // Sets a rosparam to contain the waypoint
      // ----------------------------------------------------------------------	
			if (connected) {
				var waypoint = new ROSLIB.Param({
					ros : ros,
					name : "waypoint/" + waypointName 
				});
				function setWaypointParam (location) {
					console.log ("Set waypoint " + waypoint.name + ": " + location);
					waypoint.set(location);
                    paramdump ();
				};
				// console.log ("getting the current pose");
				getPose (setWaypointParam);
			}
		}
		
		function SetWaypointZero (waypointName) {
	  // ----------------------------------------------------------------------
      // Sets a rosparam to string zero, effectively removing it
      // ----------------------------------------------------------------------	
	    	if (connected) {
				var waypoint = new ROSLIB.Param({
					ros : ros,
					name : "waypoint/" + waypointName 
				});
			// console.log ("Set waypoint " + waypoint.name + ": 0 ");
			waypoint.set("0");
      		paramdump ();
			}
		}
		
		function getPose(callbackPosition) {	
      // ----------------------------------------------------------------------
      // Subscribing to the robot's Pose-- this method uses tfClient
	  // Calls the callback with the stringified pose
      // ----------------------------------------------------------------------
      // A ROSLIB.TFClient object is used to subscribe to TFs from ROS. The fixedFrame 
      // is the frame all requested transforms will be relative to. 
      // The thresholds are the amount a TF must change in order to be republished. 
			if (connected) {
				var tfClient = new ROSLIB.TFClient({
					ros : ros,
					fixedFrame : 'map',
					angularThres : 0.01,	// threshold--smaller movements won't be reported
					transThres : 0.01
				});
				var msgString;
			
			  // We subscribe to the TF between the fixed frame ('map') and the 'base_link' frame. 
			  // Any transforms between these two frames greater than the specified threshold will 
			  // trigger the callback. The message returned is a ROS TF message.
				
				tfClient.subscribe('base_link', function (message) {
					tfClient.unsubscribe('base_link');  			// we only need this once
					msgString = JSON.stringify(message);
					console.log ("tfClient pose in " + tfClient.fixedFrame + ": " + msgString);
					callbackPosition (msgString);		
				
				/* 		
						// Formats the pose.
						// var now = new Date();

						var translation = 'x: ' + message.translation.x
						  + ', y: ' + message.translation.y
						  + ', z: 0.0';
						var rotation = 'x: ' + message.rotation.x
						  + ', y: ' + message.rotation.y
						  + ', z: ' + message.rotation.z
						  + ', w: ' + message.rotation.w;  >/
						
						console.log ('Received message on ' + tfClient.name + ': #' + message.header.seq);
						console.log (msgstring);
				*/		
				/*     	format for insertion into a table
							$('#poses > tbody > tr:first').after('<tr>'
							  + '<td>' + now.toLocaleTimeString() + '</td>'
							  + '<td>' + position + '</td>'
							  + '<td>' + orientation + '</td>');  
				*/
				});
			}
		}
	
	function moveRobotToPose (movePose) {	
		var prevStatus = "";
		var statusString;
		var moveToPoseClient = new ROSLIB.ActionClient({
			// object with following keys: * ros - the ROSLIB.Ros connection handle * serverName - the action server name * actionName - the action message name * timeout - the timeout length when connecting to the action server
			ros : ros,
		    serverName : 'move_base',
		    actionName : 'move_base_msgs/MoveBaseAction'  
		});
                                   
		var goal = new ROSLIB.Goal({
		    actionClient : moveToPoseClient,
		    goalMessage : {
			    target_pose : {
				    header : {
					   frame_id : '/map'
					},
					pose : movePose			// move_base_msg
				}
		   }
		});

		goal.on('status', function(status) {
			statusString = 'Move to pose status: ' + JSON.stringify(status);
			if (statusString !== prevStatus) {
				prevStatus = statusString;
				if (status.status == 4) {
					say (status.text);
				}
				console.log (statusString);
			}
			// moveClient.cancel ();  this does not stop the damn messages anyhow
		});
		goal.send();
		console.log ('moveRobotToPose goal sent, movepose: ' + JSON.stringify (movePose));

	}
	
	function moveRobotFromPose (distance, angle) {
		var statusString;
		if (connected) {
			var statusCount = 0;
			var prevStatus = "";
			var moveClient = new ROSLIB.ActionClient({
				ros : ros,
				serverName : 'move_base',
				actionName : 'move_base_msgs/MoveBaseAction'  
			});
			function yawToQuaternion(yaw) {
				return { x : 0,
				   y : 0,
				   z : Math.sin (yaw/2),
				   w : Math.cos (yaw/2)
				};
			};
			var goal = new ROSLIB.Goal({
				actionClient : moveClient,
				goalMessage : {
					target_pose : {
						header : {
						   frame_id : '/base_link',  	// '/base_footprint', doesn't seem to work on Loki, tho it does on Stage
						},
						pose : {
							position : {
								x :	distance,
								y : 0,
								z : 0
							},
							orientation : yawToQuaternion (angle)
						}
					}
				}
			});
			
			goal.on('status', function(status) {
				statusCount++;
				statusString = 'Move robot status: ' + JSON.stringify(status);
				if (statusString !== prevStatus) {
					prevStatus = statusString;
					if (status.status == 4) {
						say (status.text);
					}
					console.log (statusCount + ": " + statusString);
				}
				// moveClient.cancel ();  this does not stop the damn messages
			});
					/********		This never seems to be called!
							goal.on('result', function(result) {
								console.log ('Move robot result: ' + JSON.stringify(result));
								console.log ("Result: " + JSON.stringify (result));
								moveClient.cancel ();
							});
					******************/
			goal.send();
			console.log ('moveRobotFromPose goal sent');
		}
	}
		
	function paramdump () {
		console.log ("sending paramdump message");
		var dumpTopic = new ROSLIB.Topic({
			ros : ros,
			name : 'paramdump',
			messageType : 'std_msgs/String'
		});
		var pdumpMsg = new ROSLIB.Message({
			data: 'dump waypoints'
		});
		dumpTopic.publish (pdumpMsg);
	}

 /*		
	function getOdometry (callbackPosition) {	
      // ----------------------------------------------------------------------
      // Subscribing to the robot's Pose-- this is one method
      // ----------------------------------------------------------------------
      // The ROSLIB.Topic handles subscribing and publishing a ROS topic. This
      // topic interacts with the odom topic, published by the robot.
      var odomTopic = new ROSLIB.Topic({
        ros         : ros,
        name        : 'odom',
        messageType : 'nav_msgs/Odometry'
      });
      // Subscribes to the robot's odom topic, which includes the pose. When rosbridge receives the pose
      // message from ROS, it forwards the message to roslibjs, which calls this callback.
      odomTopic.subscribe(function(message) {
        // Formats the pose.
        // var now = new Date();
		//TODO  this is where we should place the robot command to move to the desired location.
        var position = 'x: ' + message.pose.pose.position.x
          + ', y: ' + message.pose.pose.position.y
          + ', z: 0.0';
        var orientation = 'x: ' + message.pose.pose.orientation.x
          + ', y: ' + message.pose.pose.orientation.y
          + ', z: ' + message.pose.pose.orientation.z
          + ', w: ' + message.pose.pose.orientation.w;
		  
		odomTopic.unsubscribe();  
		console.log ('Received message on ' + odomTopic.name + ': #' + message.header.seq);
		console.log (position);
		console.log (orientation);
		callbackPosition ();
//        $('#poses > tbody > tr:first').after('<tr>'
//          + '<td>' + now.toLocaleTimeString() + '</td>'
//         + '<td>' + position + '</td>'
//          + '<td>' + orientation + '</td>'); 
		  
		});
	}
*/	
		
	function mute () {
		if (muted === true) {
			muted = false;
			document.getElementById("muteButton").innerHTML = "Not muted";
		} else {
			muted = true;
			document.getElementById("muteButton").innerHTML = "Muted";
		}
	}
	
	function toggleWakeup () {
		useWakeup = !useWakeup;
		setWakeupButton ();
	}
	
	function toggleSimulator () {
		if (useSimulator) {
			useSimulator = false;
			document.getElementById("simulatorButton").innerHTML = "Not using simulator";
			document.getElementById("cmdr").innerHTML = "Robot Commander";
			topicName = '/cmd_vel';     	
		} else {
			useSimulator = true;					// topic name for the UR robots
			document.getElementById("simulatorButton").innerHTML = "Using simulator instead of robot";
			document.getElementById("cmdr").innerHTML = "Stage Sim Commander";
			topicName = '/cmd_vel_mux/input/navi'; 	// topic name for the Stage simulator
		}
	}
	
	function setWakeupButton () {
		if (useWakeup === false) {
			document.getElementById("wakeupButton").innerHTML = "Wakeup word is not required";
			document.getElementById("commandHeader").innerHTML = "<strong>Commands</strong>";
		} else {
			document.getElementById("wakeupButton").innerHTML = 'Wakeup word "' + wakeup[0] + '" is required' ;
			document.getElementById("commandHeader").innerHTML = '<strong>Commands--must be preceded by the word "Robot"</strong>';
		}
	}
	
	function toggleUnrecognized () {
		showUnrecognized = !showUnrecognized;
		setshowUnrecognizedButton ();
	}
	
	function setshowUnrecognizedButton () {
		if (showUnrecognized === false) {
			$('#showUnrecognizedButton').html('Not showing unrecognized speech');
		} else {
			document.getElementById("showUnrecognizedButton").innerHTML = "Showing unrecognized speech";
		}
	}
	

/*******************************************************************************
*
*                  support menu on header bar
*
**********************************************************************************/	

/* function toggles between hiding and showing the dropdown content */
function toggleDropdown() {
	var dd = document.getElementById("myDropdown");
	if (dd.style.display == "block") {
		
		dd.style.display = "none";
	} else {
		dd.style.display = "block";
	}
}

function toggleInnerDropdown() {
	var dd = document.getElementById ("innerDropdown");
	if (dd.style.display == "block") {
		dd.style.display = "none";
	} else {
		dd.style.display = "block";
	}
}

// Close the dropdown menu if the user clicks outside of it
window.onclick = function(event) {
//  console.log (event.target);
  if ((event.target.id != "ddmenu")&&(event.target.id != "settings")) { // was but did not work: (!event.target.matches('.dropbtn') && !event.target.matches('.fa fa-bars')) {
	var dd = document.getElementById("myDropdown");
	if (dd.style.display == "block") {
		dd.style.display = "none";
	}
  }
}; 




