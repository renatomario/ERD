/*
This background page is, at the moment, just used for testing.
All the functionalities are included in the content script page,
to maximise performances.
Future developments, however, will likely require the use of this page.
*/

	// console.log("Loading the extension...");
	chrome.browserAction.onClicked.addListener(function(tab_something) { 
	chrome.tabs.query({active: true, currentWindow: true}, function(tabs) {
		chrome.tabs.sendMessage(tabs[0].id, {comando: "enrich"}, function(response) {
		// console.log("Mode DEBUG ON: " + response.risultato + JSON.stringify(response.pageurls, null, "\n"));	
  });
});
});
