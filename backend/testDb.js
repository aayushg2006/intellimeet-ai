import mongoose from 'mongoose';

mongoose.connect('mongodb+srv://intellmeetuser:intellmeet1234@cluster0.rd58flh.mongodb.net/test?appName=Cluster0')
  .then(async () => {
    const Meeting = mongoose.model('Meeting', new mongoose.Schema({ roomId: String, recordingKey: String }));
    const meetings = await Meeting.find();
    console.log('All meetings count:', meetings.length);
    const withRec = meetings.filter(m => m.recordingKey);
    console.log('Meetings with recordings:', withRec.length);
    console.log(withRec);
    process.exit(0);
  });
