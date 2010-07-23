﻿/**
	@class
	@author		MacA
	
	@description
	<p>The MobyDataManager class is a singleton that handles retrieving and storing all the data
	necessary for the Moby client.</p>
*/
var MobyDataManager = (function()
{
	/**
		The singleton instance of the MobyDataManager class.
		@private
	*/
	var _instance = null;
	
	/**
		The constructor function for the MobyDataManager instance.
		@private
	*/
	function PrivateConstructor()
	{
		/************************************
			Private Properties
		************************************/
		
		/**
			Reference to the singleton that manages calling the course list service for the user
			@type	CourseListServiceManager
			@private
        */
        var _courseListServiceManager = CourseListServiceManager.getInstance();

        /**
			Reference to the singleton that manages calling the announcements service for the user
			@type	AnnouncementsServiceManager
			@private
        */
        var _announcementsServiceManager = AnnouncementsServiceManager.getInstance();

        /**
			Reference to the singleton that manages calling the threads service for the user
			@type	DiscussionsServiceManager
			@private
        */
        var _discussionsServiceManager = DiscussionsServiceManager.getInstance();

        /**
			Reference to the singleton that manages calling the courseitems service for the user
			@type	CourseItemsServiceManager
			@private
        */
        var _courseItemsServiceManager = CourseItemsServiceManager.getInstance();

        /**
			Reference to the singleton that manages calling the grades service for the user
			@type   GradesServiceManager
			@private
        */
        var _gradesServiceManager = GradesServiceManager.getInstance();

        /**
			Reference to the singleton that manages calling the dropbox service for the user
			@type	DropboxServiceManager
			@private
        */
        var _dropboxServiceManager = DropboxServiceManager.getInstance();
        
        /**
			Reference to the singleton that manages the session for the user
			@type	SessionManager
			@private
        */
        var _sessionManager = SessionManager.getInstance();
        
        /**
			Reference to the singleton that manages the client string for the user
			@type	ClientStringManager
			@private
        */
        var _clientStringManager = ClientStringManager.getInstance();
        
        /**
			A counter that keeps track of the number of services called.
			@type	Number
			@private
		*/
        var _serviceRequestCounter = 0;
        
        /**
			A counter that keeps track of the number of services that have received responses.
			@type	Number
			@private
		*/
        var _serviceResponseCounter = 0;
        
        
        /**
			A flag that keeps track of if the topics have been loaded.
			@type	Boolean
			@private
		*/
        var _topicsLoaded = false;
        
        /**
			A flag that keeps track of if the responses to me have been loaded.
			@type	Boolean
			@private
		*/
        var _responsesToMeLoaded = false;
        
		/************************************
			Private Methods
		************************************/
		
		/**
			Converts the Array of courses to a semi-colon delimited string of course IDs.
			@return	{String}	The string of course IDs
			@private
		*/
		var _getDelimitedCourseList = function(p_courses)
        {
            var coursesDelimited = "";
            for (var k = 0; k < p_courses.length; k++) 
            {
                coursesDelimited += p_courses[k].id + ";";
            }
            
            //Remove the last semicolon
            coursesDelimited = coursesDelimited.substr(0, coursesDelimited.length - 1);

            return coursesDelimited;
        };
        
        /**
			Dispatches a MobyDataEvent with the responses to me after associating each of the responses to a topic.
			@private
		*/
        var _responsesAndTopicsLoadCompleteHandler = function()
        {
			_serviceResponseCounter++;
			_associateTopicsToResponses(_instance.userTopics, _instance.responsesToMe);
			var event = new MobyDataEvent(MobyDataEvent.THREADS_RESPONSES_TO_ME_READY);
			_instance.eventDispatcher.dispatchEvent(event, _instance.responsesToMe);
			_checkIfAllDomainsComplete();
        };
        
        /**
			Assigns a reference to a UserTopic for each UserThreadResponse.
			@param	{Array}	p_topics		The collection of UserTopics
			@param	{Array}	p_responses		The collection of UserThreadResponses
			@private
		*/
        var _associateTopicsToResponses = function(p_topics, p_responses)
        {
			if (p_topics != null && p_topics != undefined && p_responses != null && p_responses != undefined)
			{
				//We need to associate each response to it's parent topic
				for(var i = 0; i < p_responses.length; i++)
				{
					var response = p_responses[i];
					for(var j = 0; j < p_topics.length; j++)
					{
						var topic = p_topics[j];
						if(response.topicId == topic.id)
						{
							response.topic = topic;
							break;
						}
					}
				}
			}
		};
		
		
		/**
			Handler for when the course list has been loaded and the rest of the services for the Happenings page need to be called.
			@param	{MobyDataEvent}	p_event		The event that was dispatched for the course list being ready.
			@private
		*/
		var _courseListReadyForHappeningsServiceCalls = function(p_event)
		{
			var currentCourses = p_event.eventData;
			var coursesDelimited = _getDelimitedCourseList(currentCourses);
			
			_sessionManager.getAuthorizationHeader(function(p_authorizationHeader, p_errorCode) 
			{
				validateAuthHeaderAndGo(p_authorizationHeader, p_errorCode, _clientStringManager.getClientString(), function() 
				{
					// call the announcements REST service
					_serviceRequestCounter++;
					_announcementsServiceManager.onLoadComplete = function(p_announcements)
					{
						_serviceResponseCounter++;
						_instance.announcements = p_announcements;
						var event = new MobyDataEvent(MobyDataEvent.ANNOUNCEMENTS_READY);
						_instance.eventDispatcher.dispatchEvent(event, _instance.announcements);
						_checkIfAllDomainsComplete();
					};
					_announcementsServiceManager.courses = currentCourses;
					_announcementsServiceManager.getAnnouncementsByUserId(_sessionManager.getMyId(), [p_authorizationHeader]);
					
					
					// call the scheduler REST services
					_serviceRequestCounter += 3;
					_courseItemsServiceManager.courses = currentCourses;
					var d = new Date();
					var startDate = d.getUTCFullYear() + "-" + (parseInt(d.getUTCMonth()) + 1) + "-" + d.getUTCDate();
					d.setDate(d.getDate() + 8);
					var endDate = d.getUTCFullYear() + "-" + (parseInt(d.getUTCMonth()) + 1) + "-" + d.getUTCDate();
					
					//Course Items
					_courseItemsServiceManager.getCourseItemsByUserContentTypesAndCourseIds_WithDatesStartingBetween(_sessionManager.getMyId(), coursesDelimited, "IQT", startDate, endDate, [p_authorizationHeader], function(p_courseItems)
					{
						_serviceResponseCounter++;
						_instance.scheduledItemsStart = p_courseItems;
						var event = new MobyDataEvent(MobyDataEvent.SCHEDULER_ITEMS_START_READY);
						_instance.eventDispatcher.dispatchEvent(event, _instance.scheduledItemsStart);
						_checkIfAllDomainsComplete();
					});
					_courseItemsServiceManager.getCourseItemsByUserContentTypesAndCourseIds_WithDatesEndingBetween(_sessionManager.getMyId(), coursesDelimited, "IQT;THREAD;MANAGED_THREADS", startDate, endDate, [p_authorizationHeader], function(p_courseItems)
					{
						_serviceResponseCounter++;
						_instance.scheduledItemsEnd = p_courseItems;
						var event = new MobyDataEvent(MobyDataEvent.SCHEDULER_ITEMS_END_READY);
						_instance.eventDispatcher.dispatchEvent(event, _instance.scheduledItemsEnd);
						_checkIfAllDomainsComplete();
					});
					_courseItemsServiceManager.getCourseItemsByUserContentTypesAndCourseIds_WithDatesDueBetween(_sessionManager.getMyId(), coursesDelimited, "", startDate, endDate, [p_authorizationHeader], function(p_courseItems)
					{
						_serviceResponseCounter++;
						_instance.scheduledItemsDue = p_courseItems;
						var event = new MobyDataEvent(MobyDataEvent.SCHEDULER_ITEMS_DUE_READY);
						_instance.eventDispatcher.dispatchEvent(event, _instance.scheduledItemsDue);
						_checkIfAllDomainsComplete();
					});

				
				
					// call the discussions REST service
					if (_instance.userTopics == null && _instance.userTopics == undefined)
					{
						_serviceRequestCounter++;
						_discussionsServiceManager.getUserTopicsByUserIdAndCourseList(_sessionManager.getMyId(), coursesDelimited, [p_authorizationHeader], function(p_userTopics)
						{
							_topicsLoaded = true;
							_serviceResponseCounter++;
							_instance.userTopics = p_userTopics;
							var event = new MobyDataEvent(MobyDataEvent.THREADS_USER_TOPICS_READY);
							_instance.eventDispatcher.dispatchEvent(event, _instance.userTopics);
							_checkIfAllDomainsComplete();
							if (_responsesToMeLoaded)
							{
								_responsesAndTopicsLoadCompleteHandler();
							}
						});
					}
					else
					{
						_instance.eventDispatcher.dispatchEvent(new MobyDataEvent(MobyDataEvent.THREADS_USER_TOPICS_READY), _instance.userTopics);
					}
					
					_serviceRequestCounter++;
					_discussionsServiceManager.getResponsesToAuthoredResponsesByUserId(_sessionManager.getMyId(), [p_authorizationHeader], function(p_responsesToMe)
					{
						_responsesToMeLoaded = true;
						_instance.responsesToMe = p_responsesToMe;
						if (_topicsLoaded)
						{
							_responsesAndTopicsLoadCompleteHandler();
						}
					});
					
			
					// call the grades REST service
					_serviceRequestCounter++;
					_gradesServiceManager.courses = currentCourses;
					_gradesServiceManager.onLoadComplete = function(p_grades)
					{
						_serviceResponseCounter++;
						_instance.grades = p_grades;
						var event = new MobyDataEvent(MobyDataEvent.GRADES_READY);
						_instance.eventDispatcher.dispatchEvent(event, _instance.grades);
						_checkIfAllDomainsComplete();
					};
					_gradesServiceManager.getGradesByUserIdAndCourseIds(_sessionManager.getMyId(), coursesDelimited, [p_authorizationHeader]);
				
				
					// call the dropbox REST service
					_serviceRequestCounter++;
					_dropboxServiceManager.courses = currentCourses;
					_dropboxServiceManager.getSubmissionsByUserIdAndCourseIds(_sessionManager.getMyId(), coursesDelimited, [p_authorizationHeader], function(p_dropboxSubmissions)
					{
						_serviceResponseCounter++;
						_instance.dropboxSubmissions = p_dropboxSubmissions;
						var event = new MobyDataEvent(MobyDataEvent.DROPBOX_READY);
						_instance.eventDispatcher.dispatchEvent(event, _instance.dropboxSubmissions);
						_checkIfAllDomainsComplete();
					});
					
				});
			});
		};
		
		
		/**
			Handler for when the course list has been loaded and the rest of the services for the Discussions page need to be called.
			@param	{MobyDataEvent}	p_event		The event that was dispatched for the course list being ready.
			@private
		*/
		var _courseListReadyForDiscussionsServiceCalls = function(p_event)
		{
			var currentCourses = p_event.eventData;
			var coursesDelimited = _getDelimitedCourseList(currentCourses);
			
			_sessionManager.getAuthorizationHeader(function(p_authorizationHeader, p_errorCode) 
			{
				validateAuthHeaderAndGo(p_authorizationHeader, p_errorCode, _clientStringManager.getClientString(), function() 
				{
					// call the scheduler REST services
					_serviceRequestCounter++;
					_courseItemsServiceManager.courses = currentCourses;
					var coursesDelimited = _getDelimitedCourseList(currentCourses);
					// get restricted Course Items
					_courseItemsServiceManager.getRestrictedCourseItemsByCourseIdsAndContentTypes(_sessionManager.getMyId(), coursesDelimited, "THREADS", [p_authorizationHeader], function(p_courseItems)
					{
						_serviceResponseCounter++;
						_instance.scheduledItemsRestricted = p_courseItems;
						var event = new MobyDataEvent(MobyDataEvent.SCHEDULER_ITEMS_RESTRICTED_READY);
						_instance.eventDispatcher.dispatchEvent(event, _instance.scheduledItemsRestricted);
						_checkIfAllDomainsComplete();
					});
								
				
					if (_instance.userTopics == null && _instance.userTopics == undefined)
					{
						_serviceRequestCounter++;
						_discussionsServiceManager.getUserTopicsByUserIdAndCourseList(_sessionManager.getMyId(), coursesDelimited, [p_authorizationHeader], function(p_topics)
						{
							_topicsLoaded = true;
							_serviceResponseCounter++;
							_instance.userTopics = p_topics;
							_instance.eventDispatcher.dispatchEvent(new MobyDataEvent(MobyDataEvent.THREADS_USER_TOPICS_READY), _instance.userTopics);
							_checkIfAllDomainsComplete();
						});
					}
					else
					{
						_instance.eventDispatcher.dispatchEvent(new MobyDataEvent(MobyDataEvent.THREADS_USER_TOPICS_READY), _instance.userTopics);
					}
				});
			});
		};
		
		/**
			Method used to check if all the services have received responses.
			@private
		*/
		var _checkIfAllDomainsComplete = function()
		{
			if (_serviceResponseCounter >= _serviceRequestCounter)
			{
				_instance.eventDispatcher.dispatchEvent(new MobyDataEvent(MobyDataEvent.COMPLETE));
			}	
		};
		
        
        
        /**
			Gets an authorization header and then calls the course list service to get the course list.
			@private
		*/
        var _authorizeAndGetCourseList = function()
        {
			// authorize first, then get the course list
			_sessionManager.getAuthorizationHeader(function(p_authorizationHeader, p_errorCode)
			{
				validateAuthHeaderAndGo(p_authorizationHeader, p_errorCode, _clientStringManager.getClientString(), function()
				{
					if (_instance.courses == null && _instance.courses == undefined)
					{
						// call the course list REST service
						_courseListServiceManager.onLoadComplete = function(p_courses)
						{
							_instance.courses = p_courses;
							_instance.eventDispatcher.dispatchEvent(new MobyDataEvent(MobyDataEvent.COURSE_LIST_READY), _instance.courses);
						};
						
						_courseListServiceManager.getCoursesByUserId(_sessionManager.getMyId(), [p_authorizationHeader]);
					}
					else
					{
						_instance.eventDispatcher.dispatchEvent(new MobyDataEvent(MobyDataEvent.COURSE_LIST_READY), _instance.courses);
					}
				});
			});
		};
        
        /************************************
			Public Properties
			Note: In order for these to be parsed by the documenter, they must be assigned a default value.
		************************************/
		/*
			The collection of Course objects returned by the CourseListServiceManager.
			@type	Array
			@default	null
		*/
		this.courses = null;
		
		/*
			The collection of UserAnnouncement objects returned by the AnnouncementsServiceManager.
			@type	Array
			@default	null
		*/
        this.announcements = null;
        
        /*
			The collection of CourseItem objects with start dates returned by the CourseItemsServiceManager.
			@type	Array
			@default	null
		*/
        this.scheduledItemsStart = null;
        
        /*
			The collection of CourseItem objects with end dates returned by the CourseItemsServiceManager.
			@type	Array
			@default	null
		*/
        this.scheduledItemsEnd = null;
        
        /*
			The collection of CourseItem objects with due dates returned by the CourseItemsServiceManager.
			@type	Array
			@default	null
		*/
        this.scheduledItemsDue = null;
        
        /*
			The collection of CourseItem objects that are restricted returned by the CourseItemsServiceManager.
			@type	Array
			@default	null
		*/
        this.scheduledItemsRestricted = null;
        
        /*
			The collection of DropboxSubmission objects with start dates returned by the DropboxServiceManager.
			@type	Array
			@default	null
		*/
        this.dropboxSubmissions = null;
        
        /*
			The collection of ItemGrade objects returned by the GradesServiceManager.
			@type	Array
			@default	null
		*/
        this.grades = null;
        
        /*
			The collection of UserTopic objects returned by the DiscussionsServiceManager.
			@type	Array
			@default	null
		*/
        this.userTopics = null;
        
        /*
			The collection of UserThreadResponse objects that were responses to "me" returned by the DiscussionsServiceManager.
			@type	Array
			@default	null
		*/
        this.responsesToMe = null;
        
        /*
			The collection of UserThreadResponse objects that were responses to a topic returned by the DiscussionsServiceManager.
			@type	Array
			@default	null
		*/
        this.responsesToTopic = null;
        
        /*
			The collection of UserThreadResponse objects that were responses to a response returned by the DiscussionsServiceManager.
			@type	Array
			@default	null
		*/
        this.responsesToResponse = null;
        
        /*
			The EventDispatcher used to listen for and dispatch events.
			@type	EventDispatcher
			@default	A new instance of EventDispatcher
		*/
        this.eventDispatcher = new EventDispatcher(this);
		
		
		/************************************
			Public Methods
		************************************/
		
		/*
			This method attempts to log in a user with the given authorization grant (taken from the 
			query string on the URL).
			@param	{String}	p_emailAuthGrant	The authorization grant taken from the query string on the URL.
		*/
		this.authenticateUserViaEmailGrant = function(p_emailAuthGrant)
		{
			VariableValidator.require(this, p_emailAuthGrant, "string");
			
			// log out any previous user that may have had a session stored in the browser
			_sessionManager.logOut();
			
			_sessionManager.loginWithEmailGrant(p_emailAuthGrant, function(p_success, p_errorCode)
			{
				if (p_success)
				{
					_instance.eventDispatcher.dispatchEvent(new MobyDataEvent(MobyDataEvent.AUTHORIZE_SUCCESS));
				}
				else
				{
					_instance.eventDispatcher.dispatchEvent(new MobyDataEvent(MobyDataEvent.AUTHORIZE_ERROR), p_errorCode);
				}
			});
		};
		
		/*
			This method registers listeners for all the domains needed to load the data for the "Happenings" page.
			Once a domain is loaded, the services start gettinge called on that domain.
		*/
		this.getMobyHappeningsData = function()
		{
			// add a listener for when the course list is ready, so that we can continue calling 
			// the other services for the "Happenings" page
			_instance.eventDispatcher.addEventListener(MobyDataEvent.COURSE_LIST_READY, _courseListReadyForHappeningsServiceCalls, true)
			_authorizeAndGetCourseList();
			
		};
		
		/*
			This method registers listeners for all the domains needed to load the data for the "Discussions" page.
			Once a domain is loaded, the services start gettinge called on that domain.
		*/
		this.getMobyDiscussionsData = function()
		{
			// add a listener for when the course list is ready, so that we can continue calling 
			// the other services for the "Happenings" page
			_instance.eventDispatcher.addEventListener(MobyDataEvent.COURSE_LIST_READY, _courseListReadyForDiscussionsServiceCalls, true)
			_authorizeAndGetCourseList();
		};
		
		
		this.getMobyResponsesToTopic = function(p_topicId)
		{
			_sessionManager.getAuthorizationHeader(function(p_authorizationHeader, p_errorCode) {
				validateAuthHeaderAndGo(p_authorizationHeader, p_errorCode, _clientStringManager.getClientString(), function() {
					_discussionsServiceManager.getUserResponsesByTopicId(_sessionManager.getMyId(), p_topicId, [p_authorizationHeader], function(p_responses)
					{
						_associateTopicsToResponses(_instance.userTopics, p_responses);
						_instance.eventDispatcher.dispatchEvent(new MobyDataEvent(MobyDataEvent.THREADS_RESPONSES_TO_TOPIC_READY), p_responses);
					});
				});
			});
		};
		
		this.getMobyResponsesToResponse = function(p_responseId)
		{
			_sessionManager.getAuthorizationHeader(function(p_authorizationHeader, p_errorCode) {
				validateAuthHeaderAndGo(p_authorizationHeader, p_errorCode, _clientStringManager.getClientString(), function() {
					
					_discussionsServiceManager.getUserResponsesByParentResponseId(_sessionManager.getMyId(), p_responseId, [p_authorizationHeader], function(p_responses)
					{
						_associateTopicsToResponses(_instance.userTopics, p_responses);
						_instance.eventDispatcher.dispatchEvent(new MobyDataEvent(MobyDataEvent.THREADS_RESPONSES_TO_RESPONSE_READY), p_responses);
					});
				});
			});
		};
		
		this.getMobyResponseCountsForTopic = function(p_topicId)
		{
			_sessionManager.getAuthorizationHeader(function(p_authorizationHeader, p_errorCode) {
				validateAuthHeaderAndGo(p_authorizationHeader, p_errorCode, _clientStringManager.getClientString(), function() {
					
					_discussionsServiceManager.getResponseCountsToTopic(_sessionManager.getMyId(), p_topicId, [p_authorizationHeader], function(p_responseCounts)
					{
						_instance.eventDispatcher.dispatchEvent(new MobyDataEvent(MobyDataEvent.THREADS_RESPONSE_COUNTS_FOR_TOPIC_READY), p_responseCounts);
					});
				});
			});
		};
		
		this.getMobyResponseCountsForResponse = function(p_responseId)
		{
			_sessionManager.getAuthorizationHeader(function(p_authorizationHeader, p_errorCode) {
				validateAuthHeaderAndGo(p_authorizationHeader, p_errorCode, _clientStringManager.getClientString(), function() {
					
					_discussionsServiceManager.getResponseCountsToResponse(_sessionManager.getMyId(), p_responseId, [p_authorizationHeader], function(p_responseCounts)
					{
						_instance.eventDispatcher.dispatchEvent(new MobyDataEvent(MobyDataEvent.THREADS_RESPONSE_COUNTS_FOR_RESPONSE_READY), p_responseCounts);
					});
				});
			});
		};
		
		this.getMobyTopicById = function(p_topicId)
		{
			_sessionManager.getAuthorizationHeader(function(p_authorizationHeader, p_errorCode) {
				validateAuthHeaderAndGo(p_authorizationHeader, p_errorCode, _clientStringManager.getClientString(), function() {
					
					_discussionsServiceManager.getUserTopicById(_sessionManager.getMyId(), p_topicId, [p_authorizationHeader], function(p_topic)
					{
						_instance.eventDispatcher.dispatchEvent(new MobyDataEvent(MobyDataEvent.THREADS_TOPIC_BY_ID_READY), p_topic);
					});
				});
			});
		};
		
		this.getMobyResponseById = function(p_responseId)
		{
			_sessionManager.getAuthorizationHeader(function(p_authorizationHeader, p_errorCode) {
				validateAuthHeaderAndGo(p_authorizationHeader, p_errorCode, _clientStringManager.getClientString(), function() {
					
					_discussionsServiceManager.getUserResponseById(_sessionManager.getMyId(), p_responseId, [p_authorizationHeader], function(p_response)
					{
						if (p_response != null && p_response != undefined)
						{
							_associateTopicsToResponses(_instance.userTopics, [p_response]);
						}
						_instance.eventDispatcher.dispatchEvent(new MobyDataEvent(MobyDataEvent.THREADS_RESPONSE_BY_ID_READY), p_response);
					});
				});
			});
		};
		
		this.postMobyResponseReadStatus = function(p_responseId, p_postData)
		{
			_sessionManager.getAuthorizationHeader(function(p_authorizationHeader, p_errorCode) {
				validateAuthHeaderAndGo(p_authorizationHeader, p_errorCode, _clientStringManager.getClientString(), function() {
					
					_discussionsServiceManager.setResponseReadStatus(_sessionManager.getMyId(), p_responseId, p_postData, [p_authorizationHeader], function()
					{
						_instance.eventDispatcher.dispatchEvent(new MobyDataEvent(MobyDataEvent.THREADS_RESPONSE_POST_READ_STATUS_SUCCESS));
					});
				});
			});
		};
		
		this.postMobyResponseToTopic = function(p_topicId, p_postData)
		{
			_sessionManager.getAuthorizationHeader(function(p_authorizationHeader, p_errorCode) {
				validateAuthHeaderAndGo(p_authorizationHeader, p_errorCode, _clientStringManager.getClientString(), function() {
					
					_discussionsServiceManager.postResponseToTopic(_sessionManager.getMyId(), p_topicId, p_postData, [p_authorizationHeader], function(p_newResponse)
					{
						_instance.eventDispatcher.dispatchEvent(new MobyDataEvent(MobyDataEvent.THREADS_RESPONSE_POST_TO_TOPIC_SUCCESS), p_newResponse);
					});
				});
			});
		};
		
		this.postMobyResponseToResponse = function(p_responseId, p_postData)
		{
			_sessionManager.getAuthorizationHeader(function(p_authorizationHeader, p_errorCode) {
				validateAuthHeaderAndGo(p_authorizationHeader, p_errorCode, _clientStringManager.getClientString(), function() {
					
					_discussionsServiceManager.postResponseToResponse(_sessionManager.getMyId(), p_responseId, p_postData, [p_authorizationHeader], function(p_newResponse)
					{
						_instance.eventDispatcher.dispatchEvent(new MobyDataEvent(MobyDataEvent.THREADS_RESPONSE_POST_TO_RESPONSE_SUCCESS), p_newResponse);
					});
				});
			});
		};
		
		/************************************
			Constructor Initialization
		************************************/
		// initialize managers
		_sessionManager.serviceLocation = serviceDomains[SERVICE_DOMAIN_PROXY];
		_courseListServiceManager.serviceLocation = serviceDomains[SERVICE_DOMAIN_PROXY];
		_announcementsServiceManager.serviceLocation = serviceDomains[SERVICE_DOMAIN_PROXY];
		_courseItemsServiceManager.serviceLocation = serviceDomains[SERVICE_DOMAIN_PROXY];
		_discussionsServiceManager.serviceLocation = serviceDomains[SERVICE_DOMAIN_PROXY];
		_gradesServiceManager.serviceLocation = serviceDomains[SERVICE_DOMAIN_PROXY];
		_dropboxServiceManager.serviceLocation = serviceDomains[SERVICE_DOMAIN_PROXY];
		
	}	
	
	
	/************************************
		Public Prototype Methods
	************************************/
	/**
		Returns information about the specific MobyDataManager instance.
		@name		MobyDataManager#toString
		@function
		@return		{String}	The class name
		
	*/
	PrivateConstructor.prototype.toString = function()
	{
		return	"[MobyDataManager]";
	}
	
	
	return new function()
	{
		/**
			Retrieves the instance of the MobyDataManager singleton.
		*/
        this.getInstance = function()
		{
            if (_instance == null)
			{
                _instance = new PrivateConstructor();
                _instance.constructor = null;
            }
            return _instance;
        };
    }
	
})();