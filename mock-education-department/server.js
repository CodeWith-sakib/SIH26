import express from 'express';

const app = express();
app.use(express.json());
app.use(express.text({ type: 'application/xml' }));

app.get('/v1/students/:id', (req, res) => {
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

const port = process.env.PORT || 4001;
app.listen(port, () => {
  console.log(`Mock Education REST server running on http://localhost:${port}`);
});
