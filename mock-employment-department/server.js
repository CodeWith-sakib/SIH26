import express from 'express';

const app = express();
app.use(express.text({ type: 'text/xml' }));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

app.post('/oauth/token', (req, res) => {
  const { grant_type, client_id, client_secret } = req.body;
  if (grant_type === 'client_credentials' && client_id === 'employment-client' && client_secret === 'secret-456') {
    return res.json({
      access_token: 'mock-jwt-token-for-testing',
      token_type: 'Bearer',
      expires_in: 3600,
    });
  }
  return res.status(401).json({ error: 'Invalid client credentials' });
});

app.post('/getApplicant', (req, res) => {
  const auth = req.headers.authorization;
  if (!auth || !auth.startsWith('Bearer ')) {
    return res.status(401).send(soapFault('Missing or invalid Authorization header'));
  }

  const token = auth.slice(7);
  if (!token || token.length < 10) {
    return res.status(401).send(soapFault('Invalid JWT token'));
  }

  let applicantName = '';
  let dateOfBirth = '';
  let employeeId = '';

  const body = req.body;
  if (body.includes('<applicantName>')) {
    const match = body.match(/<applicantName>([^<]+)<\/applicantName>/);
    if (match) applicantName = match[1];
  }
  if (body.includes('<dateOfBirth>')) {
    const match = body.match(/<dateOfBirth>([^<]+)<\/dateOfBirth>/);
    if (match) dateOfBirth = match[1];
  }
  if (body.includes('<employeeId>')) {
    const match = body.match(/<employeeId>([^<]+)<\/employeeId>/);
    if (match) employeeId = match[1];
  }

  const normalizedName = applicantName.toLowerCase().replace(/\\s+/g, '');

  if (normalizedName === 'rahul' || normalizedName === 'rahulkumar') {
    applicantName = 'Rahul Kumar';
    dateOfBirth = '1995-03-15';
    employeeId = 'EMP2024001234';
  } else if (normalizedName === 'priya' || normalizedName === 'priyasharma') {
    applicantName = 'Priya Sharma';
    dateOfBirth = '1993-07-22';
    employeeId = 'EMP2023005678';
  } else if (normalizedName === 'nikhil' || normalizedName === 'nikhilkorada') {
    applicantName = 'Nikhil Korada';
    dateOfBirth = '2005-12-06';
    employeeId = 'EMP2025007788';
  } else {
    return res.status(404).send(soapFault('Applicant not found'));
  }

  const soapResponse = `<?xml version="1.0" encoding="UTF-8"?>
<soap:Envelope xmlns:soap="http://schemas.xmlsoap.org/soap/envelope/">
  <soap:Body>
    <getApplicantResponse>
      <applicantName>${applicantName}</applicantName>
      <dateOfBirth>${dateOfBirth}</dateOfBirth>
      <employeeId>${employeeId}</employeeId>
    </getApplicantResponse>
  </soap:Body>
</soap:Envelope>`;

  res.set('Content-Type', 'text/xml; charset=utf-8');
  res.send(soapResponse);
});

function soapFault(message) {
  return `<?xml version="1.0" encoding="UTF-8"?>
<soap:Envelope xmlns:soap="http://schemas.xmlsoap.org/soap/envelope/">
  <soap:Body>
    <soap:Fault>
      <faultstring>${message}</faultstring>
    </soap:Fault>
  </soap:Body>
</soap:Envelope>`;
}

const port = process.env.PORT || 4002;
app.listen(port, () => {
  console.log(`Mock Employment SOAP server running on http://localhost:${port}`);
});
