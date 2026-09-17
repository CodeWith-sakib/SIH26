import express from 'express';

const educationApp = express();
educationApp.use(express.json());
educationApp.use(express.text({ type: 'application/xml' }));

educationApp.get('/v1/students/:id', (req, res) => {
  const apiKey = req.headers['x-api-key'];
  if (apiKey !== 'edu-test-key-123') {
    return res.status(401).json({ error: 'Invalid API key' });
  }

  const name = req.params.id;
  const normalizedName = name.toLowerCase().replace(/\s+/g, '');

  if (normalizedName === 'rahul' || normalizedName === 'rahulkumar') {
    return res.json({
      data: {
        student_name: 'Rahul Kumar',
        dob: '1995-03-15',
        phone: '+919800001111',
        email: 'rahul@test.com',
        roll_no: 'EDU2024001234',
        course_name: 'Bachelor of Technology',
        marks: 85.5,
      },
    });
  }

  if (normalizedName === 'priya' || normalizedName === 'priyasharma') {
    return res.json({
      data: {
        student_name: 'Priya Sharma',
        dob: '1993-07-22',
        phone: '+919800002222',
        email: 'priya@test.com',
        roll_no: 'EDU2023005678',
        course_name: 'Master of Science',
        marks: 92.0,
      },
    });
  }

  if (normalizedName === 'nikhil' || normalizedName === 'nikhilkorada') {
    return res.json({
      data: {
        student_name: 'Nikhil Korada',
        dob: '2005-12-06',
        phone: '09182820217',
        email: 'nikhilkorada06@gmail.com',
        roll_no: 'EDU2025007788',
        course_name: 'Bachelor of Technology',
        marks: 88.4,
      },
    });
  }

  return res.status(404).json({ error: 'Student not found' });
});

const employmentApp = express();
employmentApp.use(express.text({ type: 'text/xml' }));
employmentApp.use(express.json());
employmentApp.use(express.urlencoded({ extended: true }));

// Mock OAuth token endpoint
employmentApp.post('/oauth/token', (req, res) => {
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

employmentApp.post('/getApplicant', (req, res) => {
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

  const body = req.body as string;
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

  const normalizedName = applicantName.toLowerCase().replace(/\s+/g, '');

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

function soapFault(message: string): string {
  return `<?xml version="1.0" encoding="UTF-8"?>
<soap:Envelope xmlns:soap="http://schemas.xmlsoap.org/soap/envelope/">
  <soap:Body>
    <soap:Fault>
      <faultstring>${message}</faultstring>
    </soap:Fault>
  </soap:Body>
</soap:Envelope>`;
}

function startMockServers(): Promise<void> {
  return new Promise((resolve) => {
    const eduPort = Number(process.env.MOCK_EDU_PORT) || 4001;
    const empPort = Number(process.env.MOCK_EMP_PORT) || 4002;

    educationApp.listen(eduPort, () => {
      console.log(`Mock Education REST server running on http://localhost:${eduPort}`);
      employmentApp.listen(empPort, () => {
        console.log(`Mock Employment SOAP server running on http://localhost:${empPort}`);
        resolve();
      });
    });
  });
}

if (require.main === module) {
  startMockServers().catch(console.error);
}

export { educationApp, employmentApp, startMockServers };