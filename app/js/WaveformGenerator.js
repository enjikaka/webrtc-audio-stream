"use strict";var WaveformGenerator=function(t,e){function a(){return"a"+Math.floor(65536*(1+Math.random())).toString(16).substring(1)+"b"+Math.floor(65536*(1+Math.random())).toString(16).substring(1)}function r(t,e){var a=d.barWidth;0!==d.barGap&&(a*=Math.abs(1-d.barGap));var r,o=t+a/2;switch(d.barAlign){case"top":r=0;break;case"center":r=d.waveformHeight/2-e/2;break;case"bottom":r=d.waveformHeight-e}if("png"===d.drawMode){o=Math.floor(o-1),r=Math.floor(r-1);var n=v.getContext("2d");n.fillStyle=d.waveformColor,n.fillRect(o,r,a,e)}else if("svg"===d.drawMode){var i=document.createElement("path");i.setAttribute("d","M"+o+" "+r+" L"+o+" "+r+" L"+o+" "+(r+e)+" L"+o+" "+(r+e)+" L"+o+" "+r+" Z"),i.className=l.id,l.appendChild(i)}}function o(t,e,a){for(var r=0,o=t,n=t+e-1;n>=t?n>=o:o>=n;n>=t?o++:o--)r+=Math.pow(a[o],2);return Math.sqrt(r/a.length)}function n(t){return new Promise(function(e,a){t=t.getChannelData(0);for(var n=d.waveformWidth,i=Math.floor(t.length/n),h=[],s=[],l=0;n>l;l+=d.barWidth){var u={};u.position=l,u.height=o(l*i,i,t),s.push(u.height),h.push(u)}for(var v=d.waveformHeight/Math.max.apply(null,s),l=0;l<h.length;l++){var c=h[l],f=c.height,g=c.position;f*=v,r(g,f)}e()})}function i(t,e){return new Promise(function(r,o){s.decodeAudioData(t,function(t){if(!t)return void o(new Error("Could not decode audio data"));d=Object.assign({},h),d=Object.assign(d,e);var i=a();l=document.createElement("svg"),l.id=i,l.setAttribute("xmlns","http://www.w3.org/2000/svg"),l.setAttribute("version","1.1"),l.setAttributeNS(null,"viewBox","0 0 "+d.waveformWidth+" "+d.waveformHeight),u=document.createElement("style"),u.setAttribute("type","text/css"),u.appendChild(document.createTextNode("<![CDATA[path."+l.id+"{stroke:"+d.waveformColor+";stroke-width:"+(0!==d.barGap?d.barWidth*Math.abs(1-d.barGap):d.barWidth)+"}]]>")),l.appendChild(u),v=document.createElement("canvas"),v.id=i,v.width=d.waveformWidth,v.height=d.waveformHeight;var s=v.getContext("2d");s.clearRect(0,0,v.width,v.height),n(t).then(function(){if("svg"===d.drawMode){var t="data:image/svg+xml;base64,"+btoa('<?xml version="1.0" standalone="no"?><!DOCTYPE svg PUBLIC "-//W3C//DTD SVG 1.1//EN" "http://www.w3.org/Graphics/SVG/1.1/DTD/svg11.dtd">'+l.outerHTML);r(t)}else"png"===d.drawMode&&r(v.toDataURL())})})})}var d=void 0,h={waveformWidth:500,waveformHeight:80,waveformColor:"#bada55",barAlign:"center",barWidth:1,barGap:0,drawMode:"png"},s=new AudioContext||new WebkitAudioContext,l=null,u=null,v=null;return i}();
//# sourceMappingURL=WaveformGenerator.js.map