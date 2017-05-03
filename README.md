# Robot Commander

Robot Commander runs on an Android device.  

##Usage
Follow these instructions to install and run Robot Commander.

### Installation:

* Download from the Play Store or other source and install on the Android device
#### On the robot:
* Install Rosbridge: 

        sudo apt-get install ros-indigo-rosbridge-suite.

Set up a self-signed certificate ("snakeoil") to allow ssl communications between the browser and the robot. 

* Copy /etc/ssl/private/ssl-cert-snakeoil.key to /etc/ssl/certs/  (may need sudo)
* chmod /etc/ssl/certs/ssl-cert-snakeoil.key so it is readable. /etc/ssl/certs/ssl-cert-snakeoil.pem should already be readable. 

        sudo chmod 644 /etc/ssl/certs/ssl-cert-snakeoil.key
* Modify these 3 lines of the rosbridge launch file, to tell rosbridge where to find the certificate and key:
	(The rosbridge launch file is at  /opt/ros/indigo/share/rosbridge_server/launch/rosbridge_websocket.launch)

        <arg name="ssl" default="true" />
		<arg name="certfile" default="/etc/ssl/certs/ssl-cert-snakeoil.pem" />
		<arg name="keyfile" default="/etc/ssl/certs/ssl-cert-snakeoil.key" />

       
* Install tf2_web_republisher

		sudo apt-get install  ros-indigo-tf2-web-republisher


### Startup

Each time you wish to start using Robot Commander:

* Start the app.

* Bring up your robot.  

* Launch the rosbridge_server on the robot: (Refer to  http://wiki.ros.org/rosbridge_suite/Tutorials/RunningRosbridge)

        roslaunch rosbridge_server rosbridge_websocket.launch.
* Run the tf2_web_republisher on the robot:

        rosrun tf2_web_republisher tf2_web_republisher

* in the app, enter the robot's url with port number (usually 9090)

        <robot's url>:9090 
into the Robot URL box and click the Connect button.  The button should now say Disconnect, and you should hear "Connected". 
Use "wss" or "https" for the robot's websocket address.

If your robot has a local address, you may use it instead of the numeric IP address.


### Running
* Click any arrow to move the robot.
* Click the Microphone to use speech. 
* Say, "forward", or other commands.  There is a list of commands in the menu in the top right corner of the screen. 
* In environments where there is a lot of competing speech, you can turn on the "Wakeup Word" feature, in Settings.  When it is on, all commands must be prefaced by the wakeup word, "robot". 

#To Do / Issues
Though you can set waypoints, they are not persistent across shutdown/restart.  

#Dependencies

In the robot: rosbridge_server and tf2_web_republisher.
In the browser: See the *link* and *script* statements in the code.  

# Build

# License

# Authors
Joe Landau
jrlandau@gmail.com
5/3/17
