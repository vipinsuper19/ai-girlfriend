// Throwaway account for this Maestro run. No real credentials.
var email = (typeof EMAIL !== 'undefined' && EMAIL) ? EMAIL : ('qa+' + Date.now() + '@example.com');
var password = (typeof QA_PASSWORD !== 'undefined' && QA_PASSWORD) ? QA_PASSWORD : 'Maestro123';
var companion = (typeof COMPANION_NAME !== 'undefined' && COMPANION_NAME) ? COMPANION_NAME : 'Mae';
output.email = String(email);
output.password = String(password);
output.companion = String(companion);
output.apiBaseUrl = (typeof API_BASE_URL !== 'undefined' && API_BASE_URL) ? String(API_BASE_URL) : '';
console.log('Maestro throwaway email ' + output.email);
if (output.apiBaseUrl) {
  console.log('Maestro API_BASE_URL ' + output.apiBaseUrl);
}
