/*
	Copyright 2016 Renato Cortinovis

	Licensed under the Apache License, Version 2.0 (the "License");
	you may not use this file except in compliance with the License.
	You may obtain a copy of the License at

     http://www.apache.org/licenses/LICENSE-2.0

	Unless required by applicable law or agreed to in writing, software
	distributed under the License is distributed on an "AS IS" BASIS,
	WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
	See the License for the specific language governing permissions and
	limitations under the License.
*/

/*
ERD Educational Resources Discoverer - Version 1.0

This is a proof-of-concept prototype (plenty of improvements and extensions planned).
Please send comments to renato.cortinovis (open.ac.uk)

Sample test patterns to test-drive the prototype: 
Format: Google search string / number of expanded metadata / number of expansion links (vol indicator)

tree diagrams and figure probabilities of events / 2 / 2 (1381, 55)
advanced fire simulator / 1 / 1 (52)
equivalent fractions finder / 1 / 1 (1494)
Modeling Linear Relationships / 1 / 1 (109)
Solving Linear Inequalities inequality notation and a graphic representation / 1 / 1 (49)
Biology / 2 / 0
Physics / 2 / 0
Einstein Papers Project / 2 / 0

See full documentation with screenshots on GitHub
*/

var lrNode="https://node02.public.learningregistry.net/"; 
var lst=["name", "description", "author", "publisher", "contributor", "typicalAgeRange", "learningResourceType",
		"educationalRole", "interactivityType", "audience", "curator", "submitter",	"submitter_type",
		"timeRequired", "isBasedOnUrl", "licence", "useRightsURL", "url"]; // data to be displayed in snippets
var prettyLst=["Name", "Description", "Author", "Publisher", "Contributor", "Typical Age Range", "Learning Resource Type",
		"Educational Role", "Interactivity Type", "Audience",  "Curator", "Submitter", "Submitter type",
		"Time Required", "Is Based On URL", "Licence", "Use Rights URL", "URL"]; // corresponding data labels 

var snippetGElements; // elements containing Google snippets
var scrapedGResources=[]; // scraped from Google results page
var cache={}; // to cache snippets and data, avoiding useless calls to the server

// console.log("content_script injected...");
chrome.runtime.onMessage.addListener(
  function execCommand(request, sender, sendResponse) {
   if (request.comando == "enrich"){
        //console.log("content_script received command enrich from extension...");
		var u = scrape();
		sendResponse({risultato: "Scraped and processed:\n", pageurls: scrapedGResources }); // just for testing
	}
  });

function scrape(){
	var h3Elements=document.querySelectorAll('.rc > h3');
	snippetGElements=document.querySelectorAll(".rc .s");
	
	if(h3Elements.length != snippetGElements.length){
		// M: they must be parallel arrays
		alert("WARNING: scraping problem - unexpected page structure!");
	};
	for(var i=0; i<h3Elements.length; i++) {
		scrapedGResources[i]=h3Elements[i].getElementsByTagName('a')[0].href;
		tryBuildingSnippet(scrapedGResources[i], i);
	}
	console.log(scrapedGResources);
	return scrapedGResources; // returns immediately before completing async calls
}

function tryBuildingSnippet(resURL, k){
	if (resURL in cache){
		// M: display snippet - it can be done immediately in this case
		if ("snippet" in cache[resURL]) snippetGElements[k].appendChild(cache[resURL].snippet);	
		getResStandards(resURL,k);		
	}else {
		// A: this resource metadata are not yet cached
		cache[resURL]={}; 
		var xmlhttp = new XMLHttpRequest();
		var url = lrNode+"obtain?request_id="+resURL;
		xmlhttp.onreadystatechange = function processLRresponse(){ 
			if (xmlhttp.readyState == 4 && xmlhttp.status == 200) {
				var resData = JSON.parse(xmlhttp.responseText);
				if (resData.documents.length !=0) {
					// A: found meta/para data concerning this resource
					console.log("tryBuildingSnippet found data for: "+resURL );
					cacheMetaParaData(resURL, resData); // this will fill-in the cache entry
					snippetGElements[k].appendChild(cache[resURL].snippet);
				}
				getResStandards(resURL, k); // this is to be attempted also in case there are no metadata
			}	
		}
		//console.log("tryBuildingSnippet - processing: k= "+ k + " " + resURL);
		xmlhttp.open("GET", url, true);
		xmlhttp.send();
	}
}

function cacheMetaParaData(resURL, resData){
	for (var i=0; i<resData.documents[0].document.length; i++){
		if (resData.documents[0].document[i].payload_placement.toLowerCase()=="inline"){
			var schemas=[];
			schemas=resData.documents[0].document[i].payload_schema.map(function(e){return e.toLowerCase()});
			if (schemas.indexOf("lrmi") != -1){
				processLRMIPayload(resData.documents[0].document[i], resURL);
				break; // just process the first (more recent?) useful document
			}
			else if (schemas.indexOf("nsdl_dc") != -1){console.log("Payload not yet handled for "+resURL+": "+schemas.toString())}
			else if (schemas.indexOf("lom") != -1) {console.log("Payload not yet handled for "+resURL+": "+schemas.toString())}
			else if (schemas.indexOf("comm_para 1.0") != -1) {console.log("Payload not yet handled for "+resURL+": "+schemas.toString())}
		}	
	}
}	

function processLRMIPayload(envelope, resURL){ 
	var info=extractMetadata(envelope, resURL);
	cache[resURL]["metadata"]=info;
	// console.log(JSON.stringify(info));
	cache[resURL]["snippet"]=prepareMetadataSnippet(info);
}

function extractMetadata(envelope, resURL){
	var info={};
	// M: process first the envelope and get some useful metadata
	if ('identity' in envelope) {
		$.each(envelope.identity, function(key, val){
			switch(key.toLowerCase()){
				case "curator":
					info[key]=getValue(val);
					break;
				case "submitter":
					info[key]=getValue(val);
					break;
				case "submitter_type":
					info[key]=getValue(val);
					break;
				case "contributor":
					info[key]=extractValuesFromArrOfObjs(val,"name").join(", ");
					break;

			}
		});
	}
	// M: process now the LRMI resource_data payload
	if (envelope.resource_data.items) envelope.resource_data=envelope.resource_data.items[0].properties;
	   // because sometimes resource_data are incapsulated in a property item (e.g. http://www.einstein.caltech.edu/)
	$.each(envelope.resource_data, function(key, val){
		switch(key){
			case "description":
				info[key]=getValue(val);
				break;
			case "publisher":
				info[key]=extractValuesFromArrOfObjs(val,"name").join(", ");
				break;
			case "author":
				info[key]=extractValuesFromArrOfObjs(val,"name").join(", ");
				break;
			case "typicalAgeRange":
				info[key]=getValue(val);
				break;
			case "learningResourceType":
				info[key]=getValue(val);
				break;
			case "audience":
				info[key]=extractValuesFromArrOfObjs(val,"educationalRole").join(", ");
				break;
			case "educationalRole": // redundant with the previous one?
				info[key]=getValue(val);
				break;
			case "interactivityType":
				info[key]=getValue(val);
				break;
			case "name":
				info[key]=getValue(val);
				break;
			case "timeRequired":
				info[key]=getValue(val);
				break;
			case "timeRequired":
				info[key]=getValue(val);
				break;
			case "useRightsURL":
				info[key]=getValue(val);
				break;
			case "licence":
				info[key]=getValue(val);
				break;
// M: for testing:
			case "url":
				info[key]=getValue(val);
				break;
		}
	});
	return info;
}	

function getValue(prop) {
    if (prop instanceof Array) return (prop.join(", "));
    else if (typeof prop == "object") return JSON.stringify(prop);
	else return prop;
}

function extractValuesFromArrOfObjs (arr,field){
	var info=[];
	for (var i=0;i<arr.length;i++){
		info.push(arr[i][field])
	}
	return info;
}

function prepareMetadataSnippet(info){
	var myDiv= document.createElement("div"); myDiv.className="mySnippet";// styled in mystyles.css
	// myDiv.style="margin:5px 0px; background-color:yellow; display:table"; 
	for (var i=0;i<lst.length;i++){ // force proper display order
		if (lst[i] in info){
			var nodeL = document.createTextNode(prettyLst[i]+": ");
			var nodeR = document.createTextNode(info[lst[i]]);
			var snLeft = document.createElement('span'); snLeft.appendChild(nodeL); snLeft.className="snLeft";
			snLeft.style="display: table-cell; padding: 3px;  width: 15%;"; 
			var snRight = document.createElement('span'); snRight.appendChild(nodeR); snRight.className="snRight";
			snRight.style="display: table-cell; padding: 3px;  width: 85%;"
			var myRow = document.createElement('DIV'); myRow.className="myRow";
			myRow.style="display:table-row"
			myRow.appendChild(snLeft); myRow.appendChild(snRight);
			myDiv.appendChild(myRow);
		}
	}
	return myDiv;
}

function getResStandards(resURL, k){
	var xmlhttp = new XMLHttpRequest();
    var url =  lrNode+"extract/standards-alignment-related/discriminator-by-resource?resource="+resURL+"&ids_only=true";
	xmlhttp.onreadystatechange = function processLRresponseStd(){ 
		if (xmlhttp.readyState == 4 && xmlhttp.status == 200) {
			var locArr = JSON.parse(xmlhttp.responseText);
			var standards=[];
			for (var i=0; i<locArr.documents.length;i++){
				standards[i]=locArr.documents[i].result_data.discriminator;	
			}
			// console.log("standards identified for res "+k+":  "+JSON.stringify(standards));
			getResourcesSameStandards(k, standards);
		}
	}
	//console.log("getResStandards - processing: "+k+"   "+ resURL);
	xmlhttp.open("GET", url, true);
	xmlhttp.send();
}

function getResourcesSameStandards(k, standards){
	var relatedResources=[];
	var counterSemaphore=0; // number of async calls
	for (var i=0;i<standards.length;i++){
		counterSemaphore++; // one more async call
		var url = lrNode+"extract/standards-alignment-related/resource-by-discriminator?discriminator="
		           +standards[i]+"&ids_only=true";
		// console.log("getResourcesSameStandards k="+k+": "+url);
		$.getJSON(url, function getResourcesSameStandard(alignDocuments){
			for (var i=0; i<alignDocuments.documents.length;i++){
				relatedResources.push(alignDocuments.documents[i].result_data.resource);	
			}
			counterSemaphore--; // one more async call terminated
			if (counterSemaphore==0) { // all asynchronous calls terminated, this must be the last one
				if (relatedResources.length!=0) { 
					rank(k, relatedResources);
				}	
			}	
		}); 
	}
}

function rank (k, relatedResources){
	// console.log("unranked related resources for k="+k+":  "+relatedResources.join(", "));
	var exampleRes=scrapedGResources[k];
	/* M: construct a set with all unique related resources: */
	var mySet = new Set(relatedResources); // a set makes sure  every element is unique
	mySet.delete(exampleRes); // eliminate itself from related resources

	// M: transform set to a more convenient object sim:
	sim={};
	mySet.forEach(function(item) {
		sim[item]=0; //  prepare to compute similarity vector
	});

	// M: compute similarity vector sim{res0:integer, res1:integer}  */
	relatedResources.forEach(function(item) {
		sim[item]++;
	});
	delete sim[exampleRes];

	// M: sort similarity vector
	rankedRelatedResources = Object.keys(sim).sort(function(a,b){return sim[b]-sim[a]});

	prepareSameStandardsExpansionSnippet(k, rankedRelatedResources);
}

function prepareSameStandardsExpansionSnippet(k, resources){
	var myDiv= document.createElement("div"); myDiv.className="expansButtons"; // to be styled in css file
	var tNode = document.createTextNode("Get similar resources: ");
	
	var btn = document.createElement("BUTTON");
//	btn.onmouseover=closureExpandMin(resources.slice(0,9)); 
//	btn.onmouseout=function(){popupWin.close()}; 
	btn.onclick=closureExpandMin(resources);
	var tBtn = document.createTextNode("Aligned to same standard ("+resources.length+" available)"); 
	btn.appendChild(tBtn); // button text
	myDiv.appendChild(tNode); myDiv.appendChild(btn);
	snippetGElements[k].appendChild(myDiv);
}

function closureExpandMin(resources){
	return function expand (e){
		popupWin = window.open("", "", "width=800, height=500, top="+e.screenY+", left="+e.screenX); // lasciato globale per poterlo chiudere facilmente
		popupWin.document.title="Resources with similar standards alignments";
		var EXPWINcontainer=document.createElement('DIV'); EXPWINcontainer.className="EXPWINcontainer";
		popupWin.document.body.appendChild(EXPWINcontainer);
		var h = document.createElement("H2");
		h.appendChild(document.createTextNode("Additional resources with similar standards alignments"));
		EXPWINcontainer.appendChild(h);
		h = document.createElement("H3");
		EXPWINcontainer.appendChild(document.createTextNode("Resources ranked by similarity, that is, by the number of aligned resources in common with the resource you have selected"));
		var clipped = false; 
		if (resources.length > 10){
			clipped=true;
			resources=resources.slice(0,9);
		}
		for (var i=0;i<resources.length;i++){
			var resURL=resources[i];
			var resSnippet = document.createElement('DIV');
			resSnippet.className="resSnippet";
			resSnippet.style="border:2px solid black; margin:20px";
			var resID = document.createElement('p');
			resID.style="margin:10px";
			var a = document.createElement('a');
			a.setAttribute('href',resURL.toString());
			a.innerHTML = resURL.toString();
			resID.appendChild(a);
			resSnippet.appendChild(resID);
			EXPWINcontainer.appendChild(resSnippet);
			if (cache[resURL]) {
				if (cache[resURL].snippet) {
					// console.log("EXPWIN - found in cache: "+resURL+ resURL+ JSON.stringify(cache[resURL]));
					resSnippet.appendChild(cache[resURL].snippet);
				}
			} else {
				// A: this resource metadata are not yet cached
				cache[resURL]={}; 
				var url= lrNode+"obtain?request_id="+resURL;
				$.getJSON(url, createCallBackCacheData(resURL, resSnippet));// passing the values to keep
			}
		}
		if (clipped){
			// proper paging to be added
			var resSnippet = document.createElement('DIV');
			resSnippet.className="resSnippet";
			resSnippet.style="border:2px solid black; margin:20px";
			var resID = document.createElement('p');
			resID.style="margin:10px";
			resID.innerHTML=" ... and so on... ";
			resSnippet.appendChild(resID);
			EXPWINcontainer.appendChild(resSnippet);
		}
	}
}

function createCallBackCacheData(resURL, resSnippet){
	return  function(resDocs){
		if (resDocs.documents.length !=0) {
			// A: found meta/para data concerning this resource
			cacheMetaParaData(resURL, resDocs); // this will attempt to fill-in the cache entry with parsed metadaa
			//console.log("EXPWIN - prepared in cache: "+ resURL+ JSON.stringify(cache[resURL]));
			resSnippet.appendChild(cache[resURL].snippet);
		}
	}
}
