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
var ros;						// this will be the connection to ROS
var topicName = '/cmd_vel';     					// topic name for the UR robots
//	var topicName = '/cmd_vel_mux/input/navi';     		// topic name for the Stage simulator
//	var topicName = '/turtle1/cmd_vel'; 	    		// this allows testing with turtlesim
var speedFactor = 1.0;								// multiplies or divides speed to go faster or slower
var linearSpeed = 0.3, angularSpeed = 1.0;			// initial speed
var repeatInterval = 20;							// wait time between repeats, in ms
var linearRepeat = 60 * (1000 / repeatInterval);
var angularRepeat = 60* (1000 / repeatInterval);	// max number of times to repeat command
var stopMotion = true;
var robotUrl;
var muted = false;
var wakeup = ["robot", "loki", "magni"];
var useWakeup = false;
var showUnrecognized = true;
var infoMsg;
var useSimulator = false;
var mic, micSlash, micBg;
var g_version = "0.0.0";
var g_versionCode = "0";
var g_appName = "Robot Commander";
var g_repeatableCommand = null;
	

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
		// temp = "ws://" + location.hostname + ":9090";  // guess at it
		temp = "ubiquityrobot.local";   				  // use the default
	}
	document.getElementById("robotUrlEntry").value = temp;
	
	if (localStorage.getItem ("useWakeup") !== null) {
		useWakeup = (localStorage.getItem ("useWakeup") == "true");
	} 
	setWakeupButton ();

	if (localStorage.getItem ("showUnrecognized") !== null) {
		showUnrecognized  = (localStorage.getItem ("showUnrecognized") == "true");		
	} 
	setshowUnrecognizedButton ();
	
	if (localStorage.getItem ("muted") !== null) {
		muted = (localStorage.getItem ("muted") == "true");		
	} 
	setMuteButton ();
	
	if (localStorage.getItem ("useSimulator") !== null) {
		useSimulator = (localStorage.getItem ("useSimulator") == "true");		
	} 
	setSimulatorButton ();
	
	linearSpeed = localStorage.getItem("linearSpeed");
	if (linearSpeed == undefined || linearSpeed == null) {
		linearSpeed = 0.4
	} else {
		linearSpeed = parseFloat(linearSpeed, 1.0)
	}
	
	angularSpeed = localStorage.getItem("angularSpeed");
	if (angularSpeed == undefined || angularSpeed == null) {
		angularSpeed = 0.4
	} else {
		angularSpeed = parseFloat(angularSpeed, 1.0)
	}
	
	//--------------------application Info------------------------------
	cordova.getAppVersion.getVersionCode (function (app) {
		g_versionCode = app;	
	});
	cordova.getAppVersion.getVersionNumber(function (version) {
		g_version = version;
		document.getElementById ("version").textContent = "Version " + g_version + ", version code " + g_versionCode;
	});
	cordova.getAppVersion.getAppName(function (app) {
		g_appName = app;	
	});
	document.getElementById ("platform").textContent = "Platform: " + device.platform + " " + device.version;	

//		if (window.SpeechSynthesisUtterance === undefined) {
//			muted = true;	}
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
						permissionRequests.push (permission);
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
	
	ros.on('connection', function() {
		var connectButton;
		console.log ('Connected to websocket server.');
		localStorage.robotUrl = robotUrl;
		connectButton = document.getElementById("connectButton");
		connectButton.innerHTML = "Disconnect";
		connectButton.style.background="#00cc00";    		// green
		$('.toggle').removeClass('gbutton').addClass('mbutton');		// change button colors	
		$('.toggle2').removeClass('gbutton').addClass('mikeCircle');			
		$('.toggle3').removeClass('gbutton').addClass('btn-danger');	
		
		say ('connected');
		connected = true;
		showMotionArrows ();
	});
		
	ros.on ('error', function(error) {
		console.log (error);
		 say ('Darn. We failed to connect.');
		 //none of the following work... 
		 //alert (error.stack);
		 //alert (error.message);
		 //alert (JSON.stringify(error));
		 bootbox.alert ({
			 title: 'Connection Failure',
			 message: 'Error connecting to websocket server. Check that Rosbridge is running on the robot.',
			 className: 'bootbox-msg'
		 });
	});

	ros.on('close', function() {
		var connectButton;	
		if (connected) {			// throw away a second call
			connected = false;
			connectButton = document.getElementById("connectButton");
			connectButton.style.background = "#006dcc";    
			connectButton.innerHTML = "Connect";
			$('.toggle').toggleClass('mbutton gbutton');
			$('.toggle2').toggleClass('mikeCircle gbutton');			
			$('.toggle3').toggleClass('btn-default btn-danger');			
			say ('connection closed'); 
			//toggleMotionArrows ();			
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
		robotUrl = robotUrl.replace(/\s+/g, '');				//removes whitespace
		if (robotUrl === '') {
			bootbox.alert ("Please supply the robot's IP address");
			return;
		} 
		//robotUrl = "ws://10.0.0.21:9090"		// for testing
		//robotUrl = "ws://george.local:9090"	// for testing
		// normalize the addressrobotUrl = robotUrl.replace("https:", "wss:");
		robotUrl = robotUrl.replace("http:", "ws:");
		if ((robotUrl.slice (0,6) != "wss://") && (robotUrl.slice (0,5) != "ws://")) {
			robotUrl = "ws://" + robotUrl
		}
		if (robotUrl.charAt(robotUrl.length - 5) != ":") {
			robotUrl = robotUrl + ":9090"
		}	
			/*bootbox.alert 
				("The robot's URL should begin with http, https, ws, or wss, " + 
					"and end with a port number, like ':9090'.");*/
					
		document.getElementById("robotUrlEntry").value = robotUrl;	
		// handle local addresses
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
			$("#connectButton").text("Connecting");
			$('#connectButton').css({"background-color": 'grey'});
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
			$("#connectButton").text("Connecting");
			$("#connectButton").style.background="grey";    	
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
			bootbox.alert ({
			title: 'Recognition error',
			message: JSON.stringify (err),
			className: 'bootbox-msg'
		 });
		}
	}
	
	function recogOnresult (results) {
		console.log("recogOnresult " + results);
		
		function isFindable (lookfor) {
			var lookfors = ["aeroplane","bicycle","bird","boat","bottle","bus","car","cat","chair","cow","diningtable",
				"dog","horse","motorbike","person","pottedplant","sheep","sofa","train","tvmonitor"];
			return lookfors.includes(lookfor.toLowerCase());
		}
		
		function getDistance (quantity, what) {
			var howmany;
			howmany = Number(quantity);
			if (isNaN (howmany)) {
				if (quantity == "to" || quantity == "too") {
					howmany = 2;
				} else if (quantity == "for" || quantity == "four") {
					howmany = 4;
				} else if (quantity == "one") {
					howmany = 1;
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
		var candidate, topCandidate = "";		
		var allResults = "";
		var dist = 0;
		var altNumber;		
		
		//	if (recognition.continuous == true)	{recognition.stop ()}	
			
		testAllCandidates:
		for (var i = 0; i < results.length; ++i) {
			candidate = results[i].toLowerCase().trim();
			candidate = candidate.replace ("way point", "waypoint");			
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
				case 'ahead':
				case 'advance':
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
				case 'keep':
					if (words.length == 2 && words[1] == "going") {			
						x = linearSpeed;
						sendTwistMessage (x, z);
					} else {
						commandFound = false;
					}
					break testCandidate;
				case "reverse":
				case "backward":
				case "retreat":
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
							if (words.length == 2 ) {	
								sendTwistMessage (0, -dist);
							} else {
								moveRobotFromPose (0, -dist);
							}	
							break rotswitch;
						case "left":
							if (words.length == 2 ) {	
								sendTwistMessage (0, dist);
							} else {
								moveRobotFromPose (0, dist);
							}
							break rotswitch;
						default:
							commandFound = false;
							break testCandidate;
					}
					break testCandidate;
					
				case "turn":
					turnswitch: switch (words [1]) {
						case "right":
							z = -angularSpeed;
							break turnswitch;
						case "left":
							z = angularSpeed;
							break turnswitch;
						case "around":
						case "round":
							moveRobotFromPose (0, -Math.PI);
							break testCandidate;
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
					sendTwistMessage (0, 0);
					cancelRobotMove ();
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
				case "find":
					if (words.length == 2) {
						if (isFindable (words[1])) {
							findObject (words[1]);
						} else {
							say (words [1] + " is not a findable object")
						}
					} else if (words.length == 3) {
						if (isFindable (words[1] + words[2])) {
							findObject (words[1] + words[2]);
						} else {
							say (words [1] + " " + words[2] + " is not a findable object")
						}
					} else {
						say ("The find command must be followed by just one word indicating what to find.")
					}
						
					break testCandidate;
				case "battery":
					getBattery ();
					break testAllCandidates;
				case "help":
					$('#helpModal').modal('show');
					break testAllCandidates;
				case "again":
				case "repeat":
					if (g_repeatableCommand) {
						recogOnresult ([g_repeatableCommand]); 
					} else {
						say ("there is no repeatable command");
						commandFound = false;
					}
					break testCandidate;
				default: 
					commandFound = false;
					break testCandidate;
			}	// end of testCandidate
			
		// save the command for re-use, but not if it's a waypoint command or "again"
			
			if (candidate !== "again" && candidate !== "repeat") {
				if (commandFound) {
					g_repeatableCommand = candidate;
				} else {
					g_repeatableCommand = null;
				}
			}

		// it may yet be a waypoint command
			if (!commandFound) {
				if (words && words.length > 1) {
					if ((words [0] == "set") && (words [1] == "waypoint")) {		// trim the word "set"
						words = words.slice (1);
					}
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
		if (commandFound) {
			altNumber = i;
			break testAllCandidates;
		}
		}		// end of for loop
		
		console.log (allResults);
		if (commandFound) {								// publish the command
			if (altNumber > 1) {
				commands = candidate + " (alt. #" + (altNumber + 1) + " of " + results.length + ") " + commands;
			} else {
				commands = candidate;
			}
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
		} else if (showUnrecognized && (allResults != "")) {
				addLog ("? " + allResults, "red");
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

		function sendTwistMessage(xMove, zMove) {
			var reps = 0;
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
			if ((xMove == 0) && (zMove == 0 )) {		// it is a stop command
				reps = 0;
				cmdVel.publish (twist);
			} else {
				reps = Math.max (1, Math.abs (twist.linear.x) > 0 ? linearRepeat : (Math.abs (twist.angular.z) > 0 ? angularRepeat : 1));
				stopMotion = false;
				console.log ("Sending Twist x:" + xMove + " z:" + zMove + ", " + reps + " repetitions at " + repeatInterval + " ms. interval");
				if (typeof cmdVel.ros != "undefined") {			// this would be if we are not connected
					publishCmd ();
				}
			}
			
			function publishCmd() {
				if (!stopMotion) {					// can be set while command is repeating -- purpose is to stop repitition
					console.log ("repeating twist " + reps);
					cmdVel.publish (twist);
					if (reps > 1) {
						setTimeout (publishCmd, repeatInterval);
						reps = reps - 1;
					}
				}
			}
		}
		
		function twistNoRepeat (xMove, zMove) {
			sendTwistMessage (xMove, zMove);
			g_repeatableCommand = null;
		}
		function arrowUpGo () {
			twistNoRepeat (linearSpeed, 0.0);
			addLog ("forward button");
		}
		function arrowDownGo () {
			twistNoRepeat (-linearSpeed, 0.0);
			addLog ("back button");
		}
		function arrowRightGo () {
			twistNoRepeat (0, -angularSpeed);	
			addLog ("rotate right button");
		}
		function arrowLeftGo () {
			twistNoRepeat (0, angularSpeed);
			addLog ("rotate left button");
		}
		function fwdTurnLeft () {
			twistNoRepeat (linearSpeed, angularSpeed);
			addLog ("Forward turn left button");
		}
		function fwdTurnRight () {
			twistNoRepeat (linearSpeed, -angularSpeed);
			addLog ("Forward turn right button");
		}
		function backTurnLeft () {
			twistNoRepeat (-linearSpeed, -angularSpeed);
			addLog ("Back turn left button");
		}
		function backTurnRight () {
			twistNoRepeat (-linearSpeed, angularSpeed);
			addLog ("Back turn right button");
		}
		function stopButton () {
			stopMotion = true;
			cancelRobotMove ();
			twistNoRepeat (0.0, 0.0);
			addLog ("stop button");
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
	  
		function getWaypointValue (paramname) {
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
				waypoint.name = "/waypoint/" + waypointName;
				waypoint.get(function(value) {
					if  (!value) {
						say ('Waypoint ' + waypointName + ' was not found');
						// alert ('Waypoint ' + waypointName + ' was not found');
						}
					else {
						console.log ('Value of waypoint ' + waypointName + ': ' + value);
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
					name : "/waypoint/" + waypointName 
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
					name : "/waypoint/" + waypointName 
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
					let q = message.rotation;
					if (q.x == 0 && q.y == 0 && q.z == 0 && q.w == 0){
						bootbox.alert ({
							title: 'Position Unknown',
							message: "The waypoint was not set because the robot's position could not be determined.",
							className: 'bootbox-msg'
						});
					} else {
						callbackPosition (msgString);
					}
				
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
		    serverName : '/move_base',
		    actionName : 'move_base_msgs/MoveBaseAction'  
		});
                                   
		var goal = new ROSLIB.Goal({
		    actionClient : moveToPoseClient,
		    goalMessage : {
			    target_pose : {
				    header : {
					   frame_id : '/map'
					},
					pose : movePose			
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
		});
		
		goal.on('result', function(result) {
			console.log ('Move to pose result: ' + JSON.stringify(result));
			sendMarker (feedback);
		});
			
		goal.on('feedback', function(feedback) {
			console.log ('Move to pose feedback: ' + JSON.stringify(feedback));
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
				serverName : '/move_base',
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
				statusString = 'Move FromPose status: ' + JSON.stringify(status);
				if (statusString !== prevStatus) {
					prevStatus = statusString;
					if (status.status == 4) {
						say (status.text);
					}
					console.log (statusCount + ": " + statusString);
				}
			});

			goal.on('result', function(result) {
				console.log ('Move FromPose result: ' + JSON.stringify(result));
			});
			
			goal.on('feedback', function(feedback) {
				console.log ('Move FromPose feedback: ' + JSON.stringify(feedback));
				sendMarker (feedback);
			});
			
/*
	Move to pose feedback looks like this: 
	{"base_position":
		{"header":
			{"stamp":
				{"secs":1022,
				 "nsecs":600000000
				},
			"frame_id":"map",
			"seq":0},
		"pose":
			{"position":
				{"y":2.3130476097425627,
				 "x":2.036709309305331,
				 "z":0},
			 "orientation":{"y":0,"x":0,"z":0.5107545852738863,"w":0.8597265574714442}
			}
		}
	}
*/	
			goal.send();
			console.log ('moveRobotFromPose goal sent, message: ' + JSON.stringify (goal.goalMessage));
		}
	}
	
	function cancelRobotMove () {
		if (connected) {
			var moveClient = new ROSLIB.ActionClient({
				ros : ros,
				serverName : '/move_base',
				actionName : 'move_base_msgs/MoveBaseAction'  
			});
			moveClient.cancel ();  //cross fingers and hope?
		}
	}
	
	function sendMarker () { //(atPose) {
		var markerTopic = new ROSLIB.Topic({
				ros : ros,
				name : "/visualization_marker",
				messageType : "visualization_msgs/Marker" 
			});
	
		var marker = new ROSLIB.Message({
			header: {
				frame_id : "base_link",			// or just ""?
				stamp : {}			
			},
			ns: "Commander",
			id: 0,
			type: 2,		//visualization_msgs::Marker::SPHERE,
			action: 0,		//visualization_msgs::Marker::ADD,
			pose: {
				position: {
				x : 1,
					y : 1,
					z : 1
				},
				orientation: {
					x : 0.0,
					y : 0.0,
					z : 0.0,
					w : 1.0
				}
			},
			scale: {
				x : 0.2,
				y : 0.2,
				z : 0.2
			},
			color: {
				a : 1.0, // Don't forget to set the alpha!
				r : 1.0,
				g : 1.0,
				b : 0.0
			}
			//text: "Waypoint";
			//only if using a MESH_RESOURCE marker type:
			//marker.mesh_resource = "package://pr2_description/meshes/base_v0/base.dae";
		});
			
	//marker.pose = atPose;
	if (connected) {
		console.log ('Sending marker: ' + JSON.stringify(marker));
		markerTopic.publish (marker);
	} else {
		say ("You need to be connected");
	}
	}		
		
	function findObject (whatToFind) {			// find an object by looking around
		var findObj = new ROSLIB.Service({
			ros : ros,
			name : "/rotate",
			serviceType : "dnn_rotate/StringTrigger"
		});
	 
		var lookfor = new ROSLIB.ServiceRequest ({
			object : "nothing"
		  });

		lookfor.object = whatToFind;
		findObj.callService(lookfor, function (result) {
			console.log('Result for service call to find object '
			  + lookfor.object
			  + ': '
			  + result.response);
			say (result.response);
		  });
	}				
		
	function paramdump () {
		console.log ("sending paramdump message");
		var dumpTopic = new ROSLIB.Topic({
			ros : ros,
			name : '/paramdump',
			messageType : 'std_msgs/String'
		});
		var pdumpMsg = new ROSLIB.Message({
			data: 'dump waypoints'
		});
		dumpTopic.publish (pdumpMsg);
	}
	
	function testButton () {
		sendMarker ();
	}
	
	function getBattery () {
		if (connected) {
			var myNamespace = {};
			myNamespace.round = function(number, precision) {
				var factor = Math.pow(10, precision);
				var tempNumber = number * factor;
				var roundedTempNumber = Math.round(tempNumber);
				return roundedTempNumber / factor;
			};

			var batTopic = new ROSLIB.Topic({
				ros         : ros,
				name        : '/battery_state',
				messageType : 'sensor_msgs/BatteryState' 
			});
		  
			batTopic.subscribe (function (message) {
				var shortvolts = myNamespace.round(message.voltage, 2); 
				var batMsg = JSON.stringify(message.header)
				  + ', voltage: ' + message.voltage;
				
				batTopic.unsubscribe();  
				console.log (batMsg);
				say ("battery voltage is " + shortvolts + " volts ");
			});
		
		} else {
			say ("You need to be connected");
		}
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
		
function toggleMute () {
	muted = !muted;
	setMuteButton ();
	localStorage.muted = muted;
	localStorage.setItem ("muted", (muted?"true":"false"));
}

function setMuteButton () {
	if (muted) {
		document.getElementById ("muteButton").checked = true;	
	} else {
		document.getElementById ("muteButton").checked = false;	
	}
}

function toggleSimulator () {
	useSimulator = !useSimulator ;
	setSimulatorButton ();
	localStorage.setItem ("useSimulator", (useSimulator?"true":"false"));
}

function setSimulatorButton () {
	if (useSimulator) {
		document.getElementById("simulatorButton").checked = true;
		document.getElementById("cmdr").innerHTML = "Stage Sim Commander";
		topicName = '/cmd_vel_mux/input/navi'; 	// topic name for the Stage simulator
	} else {
		document.getElementById("simulatorButton").checked = false;		
		document.getElementById("cmdr").innerHTML = "Robot Commander";
		topicName = '/cmd_vel'; 
	}
}

function toggleWakeup () {
	useWakeup = !useWakeup;
	setWakeupButton ();
	localStorage.useWakeup = useWakeup;
	localStorage.setItem ("useWakeup", (useWakeup?"true":"false"));
}

function setWakeupButton () {
	if (!useWakeup) {
		document.getElementById("wakeupButton").checked = false;	
	} else {
		document.getElementById("wakeupButton").checked = true;	
	}
}

function toggleUnrecognized () {
	showUnrecognized = !showUnrecognized;
	setshowUnrecognizedButton ();
	localStorage.showUnrecognized = showUnrecognized;
	localStorage.setItem ("showUnrecognized", (showUnrecognized?"true":"false"));
}

function setshowUnrecognizedButton () {
	if (!showUnrecognized) {
		document.getElementById("showUnrecognizedButton").checked = false;
	} else {
		document.getElementById("showUnrecognizedButton").checked = true;
	}
}

function openSettings () {
	document.querySelector('[name="linearSpeed"]').value = linearSpeed * 10;
	document.querySelector('[name="linOut"]').value ="Linear speed: "+ linearSpeed;
	document.querySelector('[name="angularSpeed"]').value = angularSpeed * 10;
	document.querySelector('[name="angOut"]').value = "Angular speed: " + angularSpeed;
}

function closeSettings () {
	linearSpeed = document.querySelector('[name="linearSpeed"]').value / 10;
	angularSpeed = document.querySelector('[name="angularSpeed"]').value / 10;
	localStorage.setItem ("linearSpeed", linearSpeed.toString());
	localStorage.setItem ("angularSpeed", angularSpeed.toString());
}
	
function closeConnectAdvice () {
	showMotionArrows();
}

function showMotionArrows() {
	document.getElementById("motion").style.display = "block";
	document.getElementById("connection").style.display = "none";
}

function showConnectionAdvice() {
	document.getElementById("motion").style.display = "none";
	document.getElementById("connection").style.display = "block";
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
  //console.log ("Click event.target id is " + event.target.id);
  if ((event.target.id != "ddmenu")&&(event.target.id != "settings")&&(event.target.id != "muteButton")
	 &&(event.target.id != "showUnrecognizedButton") &&(event.target.id != "simulatorButton") &&(event.target.id != "wakeupButton" )) { // was but did not work: (!event.target.matches('.dropbtn') && !event.target.matches('.fa fa-bars')) {
	var dd = document.getElementById("myDropdown");
	if (dd.style.display == "block") {
		dd.style.display = "none";
	}
	var sett = document.getElementById ("innerDropdown");
	 if (sett && (sett.style.display == "block")) {
		sett.style.display = "none";
	}
  }
}; 




