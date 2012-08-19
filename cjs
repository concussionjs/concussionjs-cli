#!/usr/bin/python
import argparse
import shutil
import sys
import pymongo
import getpass
import os
import subprocess
from subprocess import call

from socket import *

from pymongo import Connection
connection = Connection()
db = connection.test
nexteraappsdir = '/root/nextera/apps'
apptemplatedir = '/root/nextera/app_template'
MY_URL = '107.20.230.20'


class bcolors:
    	HEADER = '\033[95m'
    	OKBLUE = '\033[94m'
   	OKGREEN = '\033[92m'
    	WARNING = '\033[93m'
   	FAIL = '\033[91m'
    	ENDC = '\033[0m'
	
	def disable(self):
        	self.HEADER = ''
        	self.OKBLUE = ''
        	self.OKGREEN = ''
        	self.WARNING = ''
        	self.FAIL = ''
        	self.ENDC = ''	

def find_open_ports(ports): 
  
    target = "localhost"  
    targetIP = gethostbyname(target)  
    #print 'Starting scan on host ', targetIP  
  
    #scan reserved ports  
    for i in range(8000, 10000):  
        s = socket(AF_INET, SOCK_STREAM)  
  
        result = s.connect_ex((targetIP, i))  
  
        if(result != 0) and (ports.find({"port":i}).count()==0):  
		return i	
	s.close()  


def writeColor(msg,color):
	return color + msg + bcolors.ENDC

def writeFail(msg):
	return writeColor(msg,bcolors.FAIL)

def writeWarning(msg):
	return writeColor(msg,bcolors.WARNING)

def writeOKGreen(msg):
	return writeColor(msg,bcolors.OKGREEN)

def writeOKBlue(msg):
	return writeColor(msg,bcolors.OKBLUE)

def getPassword():
	first = getpass.getpass("Enter password: ")
	second = getpass.getpass("Re-enter password: ")
	if first==second:
		return second
	else:
		print writeFail("Your passwords do not match")
		getPassword()

def checkIfExists(collection,keyName,keyValue):
	return (collection.find({keyName:keyValue}).count()>0)
	

def createUser(users,username):
	users.insert({"username":username,"password":getPassword()})
 
def user_crud(args):
	#print "action: {0} {1}".format(args.create,args.delete)
	if not args.create == "":
		users = db.users
		username = ""
		if args.create == "":
                	username = raw_input('Please enter an username: ')
                else:
                       	username = args.create
	 	if not checkIfExists(users,"username",username):
			createUser(users,username)
			print writeOKGreen("User {0} was created".format(username))
		else:
			print writeFail("User {0} already exists".format(args.create))
        elif not args.delete == "":
		username = ""
		if args.delete == "":
			username = raw_input('Please  enter an username: ')
		else:
			username = args.delete
		users = db.users
		if checkIfExists(users,"username",username):
			users.remove({"username":username})
			print writeOKGreen("User {0} was deleted".format(username))
		else:
			print writeFail("User {0} does not exist".format(username))
        else:
                #print "list users"
		users = db.users
		for user in users.find():
			print writeOKBlue("username: {0}".format(user["username"]))
		

def createApp(apps,name,template):
	print template
	applocation = nexteraappsdir + '/' + name
	ports = db.ports
	port = find_open_ports(ports)
	apps.insert({"name":name,"location":applocation,"port":port})
	app = apps.find_one({"name":name})
	my_id = str(app["_id"])
	proxies = db.proxies
	proxies.insert({"destinationport":port,"destination":MY_URL,"url":"/"+name})
	shutil.copytree(apptemplatedir + "/" + template,applocation)	
	templates = db.templates
	setting = templates.find_one({"name":"settings.js"})
	FILE = open(applocation + "/settings.js","w")
	FILE.writelines(setting["content"].replace("{0}",my_id).replace("{1}",name))
	FILE.close()
	ports.insert({"port":port})
	startApp(apps,name)

def deleteApp(apps,name):
        applocation = nexteraappsdir + '/' + name
        stopApp(apps,name)
	apps.remove({"name":name})
	proxies = db.proxies
	proxies.remove({"url":"/"+name})
	shutil.rmtree(applocation,ignore_errors=True)

def startApp(apps,name):
	app_location = nexteraappsdir + '/' + name
	obj = apps.find_one({"name":name})
	#command = "forever start {0}/index.js".format(obj["location"])
	command = "forever start index.js"
	#command = "forever start " + app_location + "/index.js"
	current_dir = os.getcwd()
	os.chdir(app_location)
	call(command,shell=True)
	os.chdir(current_dir)

def stopApp(apps,name):
	app_location = nexteraappsdir + '/' + name
	obj = apps.find_one({"name":name})
        #command = "forever stop {0}/index.js".format(obj["location"])
        command = "forever stop index.js"
	#command = "forever stop " + app_location + "/index.js"
	current_dir = os.getcwd()
        os.chdir(app_location)
	call(command,shell=True)
	os.chdir(current_dir)

def restartApp(apps,name):
	app_location = nexteraappsdir + '/' + name
        obj = apps.find_one({"name":name})
        #command = "forever restart {0}/index.js".format(obj["location"])
        command = "forever restart index.js"
	#command = "forever restart " + app_location + "/index.js"
	current_dir = os.getcwd()
        os.chdir(app_location)
	call(command,shell=True)
	os.chdir(current_dir)

def application_crud(args):
        if not args.create == "":
		apps = db.apps
		if not checkIfExists(apps,"name",args.create):
			createApp(apps,args.create,args.template)
			print writeOKGreen("App {0} was created".format(args.create))
		else:
			print writeFail("Application {0} already exists".format(args.create))
	elif not args.delete == "":
		app_name = ""
                if args.delete == "":
                        app_name = raw_input('Please enter an app name: ')
                else:
                        app_name = args.delete
                apps = db.apps
                if checkIfExists(apps,"name",app_name):
                        deleteApp(apps,app_name)
                        print writeOKGreen("App {0} was deleted".format(app_name))
                else:
                        print writeFail("App {0} does not exist".format(app_name))
	elif not args.start == "":
		app_name = ""
                if args.start == "":
                        app_name = raw_input('Please enter an app name: ')
                else:
                        app_name = args.start
                apps = db.apps
                if checkIfExists(apps,"name",app_name):
                        startApp(apps,app_name)
                        print writeOKGreen("App {0} was started".format(app_name))
                else:
                        print writeFail("App {0} does not exist".format(app_name))
	elif not args.stop == "":
		app_name = ""
		if args.stop == "":
			app_name = raw_input('Please enter an app name: ')
		else:
			app_name = args.stop
		apps = db.apps
                
		if checkIfExists(apps,"name",app_name):
			stopApp(apps,app_name)
			print writeOKGreen("App {0} was stopped".format(app_name))
		else:
			print writeFail("App {0} does not exist".format(app_name))
	elif not args.restart == "":
		app_name = ""
		if args.restart == "":
			app_name = raw_input('Please enter an app name: ')
		else:
			app_name = args.restart
		apps = db.apps
		if checkIfExists(apps,"name",app_name):
			restartApp(apps,app_name)
			print writeOKGreen("App {0} was restarted".format(app_name))
		else:
			print writeFail("App {0} does not exist".format(app_name))
	else:
		#print "list applications"
                apps = db.apps
                for app in apps.find():
                        print writeOKBlue("App name: {0}".format(app["name"]))

def write_nextera_epilog():
	ep =u'''
EXAMPLES:

List applications
>> nta app

List users
>> nta user

Creating an application
>> nta app -c YOUR_APP_NAME
or
>> nta app --create YOUR_APP_NAME

Creating an user
>> nta user -c YOUR_USER_NAME
or
>> nta user --create YOUR_USER_NAME

Deleting an application
>> nta app -d YOUR_APP_NAME
or
>> nta app --delete YOUR_APP_NAME

Deleting an user
>> nta user -d YOUR_USER_NAME
or
>> nta user --delete YOUR_USER_NAME
'''
	return ep

def write_nextera_title():
	title=u'''
.__   __.  __________   ___ .___________. _______ .______          ___      
|  \ |  | |   ____\  \ /  / |           ||   ____||   _  \        /   \     
|   \|  | |  |__   \  V  /  `---|  |----`|  |__   |  |_)  |      /  ^  \    
|  . `  | |   __|   >   <       |  |     |   __|  |      /      /  /_\  \   
|  |\   | |  |____ /  .  \      |  |     |  |____ |  |\  \----./  _____  \  
|__| \__| |_______/__/ \__\     |__|     |_______|| _| `._____/__/     \__\      	
	'''
	return writeOKGreen(title)

def main():
	parser = argparse.ArgumentParser(formatter_class=argparse.RawDescriptionHelpFormatter,
	description=write_nextera_title(),epilog=write_nextera_epilog())
	
	parser.add_argument('app',type=str,nargs='?',default=argparse.SUPPRESS,help="Use 'app' argument to add,delete or update your Nextera application")
	parser.add_argument('user',type=str,nargs='?',default=argparse.SUPPRESS,help="Use 'user' argument to add,delete or update your Nextera users")
	parser.add_argument('--create',"-c",type=str,default="",help="Use this option to create Nextera objects, either users or applications")
	parser.add_argument('--delete',"-d",type=str,default="",help="Use this option to delete Nextera objects, either users or applications")
	parser.add_argument('--update',"-u",type=str,default="",help="Use this option to update Nextera objects, either users or applications")
	parser.add_argument('--start',"-s",type=str,default="",help="Use this option to start an app. This will only work with the 'app' positional argument")
	parser.add_argument('--stop',"-t",type=str,default="",help="Use this option to stop an app. This will only work with the 'app' positional argument")
	parser.add_argument('--restart',"-r",type=str,default="",help="Use this option to restart an app. This will only work with the 'app' positional argument")
	parser.add_argument('--template',"-m",type=str,default="default",help="Use this option to specifiy a template when creating a new application")
	args = parser.parse_args()

	if len(sys.argv)> 1:
		if sys.argv[1].upper()=="USER":
			user_crud(args)
		if sys.argv[1].upper()=="APP":
			application_crud(args)
	else:
		parser.print_help()
if __name__ == '__main__':
	main()