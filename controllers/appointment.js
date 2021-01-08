const { validationResult } = require('express-validator/check');
const outlook = require('node-outlook');
const moment = require('moment-timezone');
const { google } = require('googleapis');
const sgMail = require('@sendgrid/mail');

const api = require('../config/api');
const urls = require('../constants/urls');
const { time_zone, days } = require('../constants/variable');
const mail_contents = require('../constants/mail_contents');
const system_settings = require('../config/system_settings');
const Appointment = require('../models/appointment');
const Activity = require('../models/activity');
// const Reminder = require('../models/reminder');
const User = require('../models/user');
const Contact = require('../models/contact');
const graph = require('@microsoft/microsoft-graph-client');

const credentials = {
  clientID: api.OUTLOOK_CLIENT.OUTLOOK_CLIENT_ID,
  clientSecret: api.OUTLOOK_CLIENT.OUTLOOK_CLIENT_SECRET,
  site: 'https://login.microsoftonline.com/common',
  authorizationPath: '/oauth2/v2.0/authorize',
  tokenPath: '/oauth2/v2.0/token',
};

const oauth2 = require('simple-oauth2')(credentials);

const getAll = async (req, res) => {
  const { currentUser } = req;

  let { date, mode } = req.query;
  if (!mode) {
    mode = 'week';
  }

  if (!date) {
    date = moment().startOf(mode);
  } else {
    date = moment(date).startOf(mode);
  }

  if (currentUser.calendar_connected && currentUser.calendar_list) {
    const { calendar_list } = currentUser;

    for (let i = 0; i < calendar_list.length; i++) {
      const { connected_calendar_type } = calendar_list[i];
      if (connected_calendar_type === 'outlook') {
        let accessToken;
        const { connected_email, outlook_refresh_token } = calendar_list[i];
        const token = oauth2.accessToken.create({
          refresh_token: outlook_refresh_token,
          expires_in: 0,
        });

        await new Promise((resolve, reject) => {
          token.refresh(function (error, result) {
            if (error) {
              reject(error);
            } else {
              resolve(result.token);
            }
          });
        })
          .then((token) => {
            accessToken = token.access_token;
          })
          .catch((error) => {
            console.log('error', error);
            return res.status(406).send({
              status: false,
              error: 'not connected',
            });
          });

        const client = graph.Client.init({
          // Use the provided access token to authenticate
          // requests
          authProvider: (done) => {
            done(null, accessToken);
          },
        });

        const ctz = currentUser.time_zone_info
          ? currentUser.time_zone_info.tz_name
          : system_settings.TIME_ZONE;
        const calendar_data = {
          client,
          ctz,
          connected_email,
          res,
          date,
          mode,
        };
        outlookCalendarList(calendar_data);
      } else {
        const oauth2Client = new google.auth.OAuth2(
          api.GMAIL_CLIENT.GMAIL_CLIENT_ID,
          api.GMAIL_CLIENT.GMAIL_CLIENT_SECRET,
          urls.GMAIL_AUTHORIZE_URL
        );
        const calendar = calendar_list[i];
        const { google_refresh_token, connected_email } = calendar;
        const token = JSON.parse(google_refresh_token);
        oauth2Client.setCredentials({ refresh_token: token.refresh_token });
        const calendar_data = {
          auth: oauth2Client,
          res,
          date,
          mode,
          connected_email,
        };
        googleCalendarList(calendar_data);
      }
    }
  } else {
    return res.send({
      status: true,
      data: [],
    });
  }
};

const get = async (req, res) => {
  const appointments = await Appointment.find({
    contact: req.params.id,
    del: false,
  }).catch((err) => {
    console.log('appointment find err', err.message);
    return res.status(500).json({
      status: false,
      error: err.message,
    });
  });

  return res.send({
    status: true,
    data: appointments,
  });
};

const googleCalendarList = (calendar_data) => {
  const { connected_email, auth, res, date, mode } = calendar_data;
  const data = [];
  const endDate = moment(date).add(1, `${mode}s`);
  const calendar = google.calendar({ version: 'v3', auth });
  calendar.calendarList.list(
    {
      maxResults: 100,
    },
    function (err, result) {
      if (err) {
        console.log(`The API returned an error: ${err}`);
        return res.status(400).json({
          status: false,
          error: err,
        });
      }
      const calendars = result.data.items;
      if (calendars) {
        const promise_array = [];
        for (let i = 0; i < calendars.length; i++) {
          const promise = new Promise(async (resolve, reject) => {
            calendar.events.list(
              {
                calendarId: calendars[i].id,
                timeMin: date.toISOString(),
                timeMax: endDate.toISOString(),
                singleEvents: true,
              },
              async (err, _res) => {
                if (err) {
                  console.log(`The API returned an error: ${err}`);
                  resolve();
                } else {
                  const events = _res.data.items;
                  const recurrence_event = [];
                  if (events.length) {
                    for (let j = 0; j < events.length; j++) {
                      const event = events[j];
                      const guests = [];
                      const contacts = [];
                      const appointments = await Appointment.find({
                        event_id: event.id,
                      })
                        .select('contact')
                        .populate({ path: 'contact', select: 'email' });

                      appointments.map((appointment) => {
                        contacts.push(appointment.contact);
                      });

                      if (event.attendees) {
                        for (let j = 0; j < event.attendees.length; j++) {
                          const guest = event.attendees[j].email;
                          const response = event.attendees[j].responseStatus;
                          guests.push({ email: guest, response });
                        }
                      }
                      const _gmail_calendar_data = {};
                      _gmail_calendar_data.title = event.summary;
                      _gmail_calendar_data.description = event.description;
                      _gmail_calendar_data.location = event.location;
                      _gmail_calendar_data.due_start =
                        event.start.dateTime || event.end.date;
                      _gmail_calendar_data.due_end =
                        event.end.dateTime || event.end.date;
                      _gmail_calendar_data.guests = guests;

                      if (event.recurringEventId) {
                        recurrence_event.push({
                          id: event.recurringEventId,
                          index: data.length,
                        });
                        _gmail_calendar_data.recurrence_id =
                          event.recurringEventId;
                      }

                      if (event.organizer) {
                        _gmail_calendar_data.organizer = event.organizer.email;
                        if (event.organizer.email === connected_email) {
                          _gmail_calendar_data.is_organizer = true;
                        }
                      }

                      _gmail_calendar_data.calendar_id = calendars[i].id;
                      _gmail_calendar_data.event_id = event.id;
                      _gmail_calendar_data.contacts = contacts;
                      _gmail_calendar_data.type = 2;
                      data.push(_gmail_calendar_data);
                    }
                    if (recurrence_event.length > 0) {
                      calendar.events.list(
                        {
                          calendarId: calendars[i].id,
                          timeMin: date.toISOString(),
                          timeMax: endDate.toISOString(),
                          singleEvents: false,
                        },
                        (err, _res) => {
                          if (err) {
                            console.log(`The API returned an error: ${err}`);
                            resolve();
                          }
                          const events = _res.data.items;
                          for (let j = 0; j < recurrence_event.length; j++) {
                            events.map((event) => {
                              if (event.id === recurrence_event[j].id) {
                                if (event.recurrence) {
                                  const index = recurrence_event[j].index;
                                  if (
                                    event.recurrence[0].indexOf('DAILY') !== -1
                                  ) {
                                    data[index].recurrence = 'DAILY';
                                  } else if (
                                    event.recurrence[0].indexOf('WEEKLY') !== -1
                                  ) {
                                    data[index].recurrence = 'WEEKLY';
                                  } else if (
                                    event.recurrence[0].indexOf('MONTHLY') !==
                                    -1
                                  ) {
                                    data[index].recurrence = 'MONTHLY';
                                  }
                                }
                              }
                            });
                          }
                          resolve();
                        }
                      );
                    } else {
                      resolve();
                    }
                  } else {
                    console.log('No upcoming events found.');
                    resolve();
                  }
                }
              }
            );
          });
          promise_array.push(promise);
        }
        Promise.all(promise_array)
          .then(() => {
            return res.send({
              status: true,
              data,
            });
          })
          .catch((err) => {
            console.log('err', err);
            if (err) {
              return res.status(400).json({
                status: false,
                error: err,
              });
            }
          });
      }
    }
  );
};

const outlookCalendarList = (calendar_data) => {
  const { client, ctz, connected_email, res, date, mode } = calendar_data;
  const data = [];
  const promise_array = [];

  client
    .api('/me/calendars')
    .header('Prefer', `outlook.timezone="${ctz}"`)
    .get()
    .then(async (outlook_calendars) => {
      const calendars = outlook_calendars.value;

      if (calendars.length > 0) {
        const endDate = moment(date).add(1, `${mode}s`);
        // The start and end date are passed as query parameters
        const startDateTime = date.toISOString();
        const endDateTime = endDate.toISOString();
        for (let i = 0; i < calendars.length; i++) {
          const calendar = calendars[i];
          const promise = new Promise(async (resolve) => {
            const outlook_events = await client
              .api(
                `/me/calendars/${calendar.id}/calendarView?startDateTime=${startDateTime}&endDateTime=${endDateTime}`
              )
              .get()
              .catch((err) => {
                console.log('outlook calendar events get err', err);
              });
            if (outlook_events && outlook_events.value) {
              const recurrence_event = [];
              const calendar_events = outlook_events.value;

              for (let j = 0; j < calendar_events.length; j++) {
                const guests = [];
                const contacts = [];
                const calendar_event = calendar_events[j];
                const appointments = await Appointment.find({
                  event_id: calendar_event.id,
                })
                  .select('contact')
                  .populate({ path: 'contact', select: 'email' });

                appointments.map((appointment) => {
                  contacts.push(appointment.contact);
                });

                if (
                  calendar_event.attendees &&
                  calendar_event.attendees.length > 0
                ) {
                  const attendees = calendar_event.attendees;
                  for (let j = 0; j < attendees.length; j++) {
                    const guest = attendees[j].emailAddress.address;
                    let response = '';
                    switch (attendees[j].status.response) {
                      case 'none':
                        response = 'needsAction';
                        break;
                      case 'organizer':
                        response = 'accepted';
                        break;
                      case 'declined':
                        response = 'declined';
                        break;
                      case 'accepted':
                        response = 'accepted';
                        break;
                      case 'tentativelyAccepted':
                        response = 'tentative';
                        break;
                      case 'notResponded':
                        response = 'needsAction';
                        break;
                      default:
                        response = 'needsAction';
                        break;
                    }
                    guests.push({ email: guest, response });
                  }
                }
                const _outlook_calendar_data = {};
                _outlook_calendar_data.title = calendar_event.subject;
                if (calendar_event.body) {
                  _outlook_calendar_data.description =
                    calendar_event.body.content;
                } else {
                  _outlook_calendar_data.description = '';
                }
                if (calendar_event.location) {
                  _outlook_calendar_data.location =
                    calendar_event.location.displayName;
                } else {
                  _outlook_calendar_data.location = '';
                }
                if (calendar_event.start) {
                  _outlook_calendar_data.due_start =
                    calendar_event.start.dateTime;
                  // _outlook_calendar_data.time_zone =
                  //   calendar_event.start.timezone;
                  // _outlook_calendar_data.due_start = moment
                  //   .tz(
                  //     _outlook_calendar_data.due_start,
                  //     _outlook_calendar_data.time_zone
                  //   )
                  //   .toISOString();
                } else {
                  _outlook_calendar_data.due_start = '';
                }
                if (calendar_event.end) {
                  _outlook_calendar_data.due_end = calendar_event.end.dateTime;
                  // _outlook_calendar_data.time_zone =
                  //   calendar_event.end.timezone;
                  // _outlook_calendar_data.due_end = moment
                  //   .tz(
                  //     _outlook_calendar_data.due_end,
                  //     _outlook_calendar_data.time_zone
                  //   )
                  //   .toISOString();
                } else {
                  _outlook_calendar_data.due_end = '';
                }
                if (calendar_event.organizer) {
                  _outlook_calendar_data.organizer =
                    calendar_event.organizer.emailAddress.address;
                  if (
                    calendar_event.organizer.emailAddress.address ===
                    connected_email
                  ) {
                    _outlook_calendar_data.is_organizer = true;
                  }
                }

                _outlook_calendar_data.contacts = contacts;
                _outlook_calendar_data.guests = guests;
                _outlook_calendar_data.event_id = calendar_event.id;
                _outlook_calendar_data.calendar_id = calendar.id;
                if (calendar_event.seriesMasterId) {
                  _outlook_calendar_data.recurrence_id =
                    calendar_event.seriesMasterId;
                  recurrence_event.push({
                    id: calendar_event.seriesMasterId,
                    index: data.length,
                  });
                }

                data.push(_outlook_calendar_data);
              }
              if (recurrence_event.length > 0) {
                for (let j = 0; j < recurrence_event.length; j++) {
                  const master_id = recurrence_event[j].id;
                  const master_event = await client
                    .api(`/me/events/${master_id}`)
                    .get()
                    .catch((err) => {
                      console.log('outlook calendar events get err', err);
                    });
                  if (master_event.recurrence) {
                    const index = recurrence_event[j].index;
                    if (
                      master_event.recurrence.pattern &&
                      master_event.recurrence.pattern.type.indexOf('daily') !==
                        -1
                    ) {
                      data[index].recurrence = 'DAILY';
                    } else if (
                      master_event.recurrence.pattern &&
                      master_event.recurrence.pattern.type.indexOf('weekly') !==
                        -1
                    ) {
                      data[index].recurrence = 'WEEKLY';
                    } else if (
                      master_event.recurrence.pattern &&
                      master_event.recurrence.pattern.type.indexOf(
                        'monthly'
                      ) !== -1
                    ) {
                      data[index].recurrence = 'MONTHLY';
                    }
                  }
                }
              }
            }
            resolve();
          });
          promise_array.push(promise);
        }

        Promise.all(promise_array).then(() => {
          return res.send({
            status: true,
            data,
          });
        });
      }
    })
    .catch((err) => {
      console.log('calendar event err', err);
    });
};
const create = async (req, res) => {
  const { currentUser } = req;
  let event_id;

  // if (!req.body.contacts) {
  //   return res.status(400).json({
  //     status: false,
  //     error: 'Contacts required',
  //   });
  // }

  if (currentUser.calendar_connected) {
    const _appointment = req.body;
    const {
      connected_email,
      connected_calendar_type,
      outlook_refresh_token,
      google_refresh_token,
      calendar_id,
      guests,
    } = req.body;

    if (connected_calendar_type === 'outlook') {
      const attendees = [];
      if (_appointment.guests) {
        for (let j = 0; j < _appointment.guests.length; j++) {
          const addendee = {
            emailAddress: {
              Address: _appointment.guests[j],
            },
          };
          attendees.push(addendee);
        }
      }
      // if (_appointment.contacts) {
      //   const contacts = await Contact.find({
      //     _id: _appointment.contacts,
      //   }).catch((err) => {
      //     console.log('appointment contacts find err', err.messages);
      //   });
      //   for (let j = 0; j < contacts.length; j++) {
      //     if (contacts[j].email) {
      //       const addendee = {
      //         emailAddress: {
      //           Address: contacts[j].email,
      //         },
      //       };
      //       attendees.push(addendee);
      //     }
      //   }
      // }
      let recurrence;
      if (_appointment.recurrence) {
        let type;
        let daysOfWeek;
        let dayOfMonth;
        switch (_appointment.recurrence) {
          case 'DAILY':
            type = 'daily';
            break;
          case 'WEEKLY':
            type = 'weekly';
            daysOfWeek = [days[moment(_appointment.due_start).day()]];
            break;
          case 'MONTHLY':
            type = 'absoluteMonthly';
            dayOfMonth = moment(_appointment.due_start).date();
            break;
          default:
            console.log('no matching');
        }

        recurrence = {
          pattern: {
            type,
            interval: 1,
            daysOfWeek,
            dayOfMonth,
          },
          range: {
            type: 'noEnd',
            startDate: moment(_appointment.due_start).format('YYYY-MM-DD'),
          },
        };
      }

      const ctz = currentUser.time_zone_info
        ? currentUser.time_zone_info.tz_name
        : system_settings.TIME_ZONE;

      const newEvent = {
        subject: _appointment.title,
        body: {
          contentType: 'HTML',
          content: _appointment.description,
        },
        location: {
          displayName: _appointment.location,
        },
        start: {
          dateTime: _appointment.due_start,
          timeZone: ctz,
        },
        end: {
          dateTime: _appointment.due_end,
          timeZone: ctz,
        },
        attendees,
        recurrence,
      };

      let accessToken;
      const token = oauth2.accessToken.create({
        refresh_token: outlook_refresh_token,
        expires_in: 0,
      });

      await new Promise((resolve, reject) => {
        token.refresh(function (error, result) {
          if (error) {
            reject(error);
          } else {
            resolve(result.token);
          }
        });
      })
        .then((token) => {
          accessToken = token.access_token;
        })
        .catch((error) => {
          console.log('error', error);
          return res.status(406).send({
            status: false,
            error: 'not connected',
          });
        });

      const client = graph.Client.init({
        // Use the provided access token to authenticate
        // requests
        authProvider: (done) => {
          done(null, accessToken);
        },
      });

      let res = await client
        .api(`/me/calendars/${calendar_id}/events`)
        .post(newEvent);
      event_id = res.id;
    } else {
      const oauth2Client = new google.auth.OAuth2(
        api.GMAIL_CLIENT.GMAIL_CLIENT_ID,
        api.GMAIL_CLIENT.GMAIL_CLIENT_SECRET,
        urls.GMAIL_AUTHORIZE_URL
      );
      const token = JSON.parse(google_refresh_token);
      oauth2Client.setCredentials({ refresh_token: token.refresh_token });
      event_id = await addGoogleCalendarById(
        oauth2Client,
        currentUser,
        _appointment
      );
    }

    if (req.body.contacts) {
      const contacts = req.body.contacts;
      for (let i = 0; i < contacts.length; i++) {
        const contact = contacts[i];

        const appointment = new Appointment({
          ...req.body,
          contact: contact._id,
          user: currentUser.id,
          type: 0,
          event_id,
          updated_at: new Date(),
          created_at: new Date(),
        });

        appointment
          .save()
          .then((_appointment) => {
            const activity = new Activity({
              content: 'added appointment',
              contacts: contact._id,
              appointments: _appointment.id,
              user: currentUser.id,
              type: 'appointments',
            });

            activity.save().then((_activity) => {
              Contact.updateOne(
                {
                  _id: contact._id,
                },
                {
                  $set: { last_activity: _activity.id },
                }
              ).catch((err) => {
                console.log('err', err);
              });
            });
          })
          .catch((err) => {
            console.log('appointment save err', err.message);
            return res.status(500).send({
              status: false,
              error: err.message,
            });
          });
      }
    }
    return res.send({
      status: true,
      event_id,
    });
  } else {
    return res.status(400).json({
      status: false,
      error: 'You must connect gmail/outlook',
    });
  }
};

const addGoogleCalendarById = async (auth, user, appointment) => {
  const calendar = google.calendar({ version: 'v3', auth });
  const attendees = [];
  if (appointment.guests) {
    for (let j = 0; j < appointment.guests.length; j++) {
      const addendee = {
        email: appointment.guests[j],
      };
      attendees.push(addendee);
    }
  }
  // if (appointment.contacts) {
  //   const contacts = await Contact.find({
  //     _id: appointment.contacts,
  //   }).catch((err) => {
  //     console.log('appointment contacts find err', err.messages);
  //   });
  //   for (let j = 0; j < contacts.length; j++) {
  //     if (contacts[j].email) {
  //       const addendee = {
  //         email: contacts[j].email,
  //       };
  //       attendees.push(addendee);
  //     }
  //   }
  // }

  let recurrence;
  if (appointment.recurrence) {
    recurrence = [`RRULE:FREQ=${appointment.recurrence};`];
  }

  const ctz = user.time_zone_info
    ? user.time_zone_info.tz_name
    : system_settings.TIME_ZONE;

  const event = {
    summary: appointment.title,
    location: appointment.location,
    description: appointment.description,
    start: {
      dateTime: appointment.due_start,
      timeZone: ctz,
    },
    end: {
      dateTime: appointment.due_end,
      timeZone: ctz,
    },
    attendees,
    recurrence,
  };
  return new Promise((resolve, reject) => {
    calendar.events.insert(
      {
        auth,
        calendarId: appointment.calendar_id,
        sendNotifications: true,
        resource: event,
      },
      function (err, event) {
        if (err) {
          console.log(
            `There was an error contacting the Calendar service: ${err}`
          );
          reject(err);
        }
        resolve(event.data.id);
      }
    );
  });
};

const edit = async (req, res) => {
  const { currentUser } = req;

  if (currentUser.calendar_connected) {
    const {
      recurrence_id,
      connected_email,
      connected_calendar_type,
      outlook_refresh_token,
      google_refresh_token,
      calendar_id,
      guests,
    } = req.body;
    const edit_data = req.body;

    const event_id = recurrence_id || req.params.id;

    if (connected_calendar_type === 'outlook') {
      let accessToken;
      const token = oauth2.accessToken.create({
        refresh_token: outlook_refresh_token,
        expires_in: 0,
      });

      await new Promise((resolve, reject) => {
        token.refresh(function (error, result) {
          if (error) {
            reject(error);
          } else {
            resolve(result.token);
          }
        });
      })
        .then((token) => {
          accessToken = token.access_token;
        })
        .catch((error) => {
          console.log('error', error);
          return res.status(406).send({
            status: false,
            error: 'not connected',
          });
        });

      const client = graph.Client.init({
        // Use the provided access token to authenticate
        // requests
        authProvider: (done) => {
          done(null, accessToken);
        },
      });

      const attendees = [];
      if (guests) {
        for (let j = 0; j < guests.length; j++) {
          const addendee = {
            emailAddress: {
              address: guests[j],
            },
          };
          attendees.push(addendee);
        }
      }
      const event = {
        subject: edit_data.title,
        body: {
          contentType: 'HTML',
          content: edit_data.description,
        },
        location: {
          displayName: edit_data.location,
        },
        start: {
          dateTime: edit_data.due_start,
          timeZone: `UTC${currentUser.time_zone}`,
        },
        end: {
          dateTime: edit_data.due_end,
          timeZone: `UTC${currentUser.time_zone}`,
        },
        attendees,
      };
      let res = await client
        .api(`/me/calendars/${calendar_id}/events/${event_id}`)
        .update(event);
    } else {
      const oauth2Client = new google.auth.OAuth2(
        api.GMAIL_CLIENT.GMAIL_CLIENT_ID,
        api.GMAIL_CLIENT.GMAIL_CLIENT_SECRET,
        urls.GMAIL_AUTHORIZE_URL
      );

      const token = JSON.parse(google_refresh_token);
      oauth2Client.setCredentials({ refresh_token: token.refresh_token });
      const data = {
        oauth2Client,
        remove_id: event_id,
        appointment: edit_data,
        time_zone: currentUser.time_zone,
      };
      await updateGoogleCalendarById(data);
    }

    if (edit_data.contacts && edit_data.contacts.length > 0) {
      for (let i = 0; i < edit_data.contacts.length; i++) {
        const contact = edit_data.contacts[i];
        const appointment = await Appointment.findOne({
          user: currentUser.id,
          event_id: req.params.id,
          contact: contact._id,
        }).catch((err) => {
          console.log('appointment find err', err.message);
        });

        if (appointment) {
          Appointment.updateOne(
            {
              _id: appointment.id,
            },
            {
              $set: {
                ...req.body,
              },
            }
          ).then(() => {
            const activity = new Activity({
              content: 'updated appointment',
              contacts: contact._id,
              appointments: appointment._id,
              user: currentUser.id,
              type: 'appointments',
              created_at: new Date(),
              updated_at: new Date(),
            });
            activity
              .save()
              .then((_activity) => {
                Contact.updateOne(
                  { _id: contact._id },
                  {
                    $set: { last_activity: _activity.id },
                  }
                ).catch((err) => {
                  console.log('err', err);
                });
              })
              .catch((err) => {
                console.log('activity save err', err.message);
              });
          });
        } else {
          const appointment = new Appointment({
            ...req.body,
            contact: contact._id,
            user: currentUser.id,
            type: 0,
            event_id: req.params.id,
          });

          appointment
            .save()
            .then((_appointment) => {
              const activity = new Activity({
                content: 'added appointment',
                contacts: contact._id,
                appointments: _appointment.id,
                user: currentUser.id,
                type: 'appointments',
              });

              activity.save().then((_activity) => {
                Contact.updateOne(
                  {
                    _id: contact._id,
                  },
                  {
                    $set: { last_activity: _activity.id },
                  }
                ).catch((err) => {
                  console.log('err', err);
                });
              });
            })
            .catch((err) => {
              console.log('appointment save err', err.message);
              return res.status(500).send({
                status: false,
                error: err.message,
              });
            });
        }
      }
    }
    if (
      edit_data.contacts.remove_contacts &&
      edit_data.contacts.remove_contacts.length > 0
    ) {
      Appointment.updateMany(
        {
          _id: { $in: edit_data.contacts.remove_contacts },
        },
        {
          $set: {
            del: true,
          },
        }
      ).catch((err) => {
        console.log('appointment delete err', err.message);
      });
    }

    return res.send({
      status: true,
    });
  } else {
    const editData = req.body;
    const appointment = await Appointment.findOne({
      user: currentUser.id,
      _id: req.params.id,
    });
    for (const key in editData) {
      appointment[key] = editData[key];
    }

    await appointment
      .save()
      .then((_appointment) => {
        const activity = new Activity({
          content: 'updated appointment',
          contacts: _appointment.contact,
          appointments: _appointment.id,
          user: currentUser.id,
          type: 'appointments',
          created_at: new Date(),
          updated_at: new Date(),
        });

        activity.save().then((_activity) => {
          Contact.updateOne(
            { _id: _appointment.contact },
            {
              $set: { last_activity: _activity.id },
            }
          ).catch((err) => {
            console.log('err', err);
          });
          const myJSON = JSON.stringify(_appointment);
          const data = JSON.parse(myJSON);
          data.activity = _activity;
          res.send({
            status: true,
            data,
          });
        });
      })
      .catch((e) => {
        let errors;
        if (e.errors) {
          console.log('e.errors', e.errors);
          errors = e.errors.map((err) => {
            delete err.instance;
            return err;
          });
        }
        return res.status(500).send({
          status: false,
          error: errors || e,
        });
      });
  }
};

const remove = async (req, res) => {
  const { currentUser } = req;

  if (currentUser.calendar_connected) {
    const { event_id, recurrence_id, calendar_id } = req.body;
    const remove_id = recurrence_id || event_id;
    if (currentUser.connected_email_type === 'outlook') {
      let accessToken;
      const token = oauth2.accessToken.create({
        refresh_token: currentUser.outlook_refresh_token,
        expires_in: 0,
      });

      await new Promise((resolve, reject) => {
        token.refresh(function (error, result) {
          if (error) {
            reject(error);
          } else {
            resolve(result.token);
          }
        });
      })
        .then((token) => {
          accessToken = token.access_token;
        })
        .catch((error) => {
          console.log('error', error);
          return res.status(406).send({
            status: false,
            error: 'not connected',
          });
        });

      const client = graph.Client.init({
        // Use the provided access token to authenticate
        // requests
        authProvider: (done) => {
          done(null, accessToken);
        },
      });

      let res = await client
        .api(`/me/calendars/${calendar_id}/events/${remove_id}`)
        .delete()
        .catch((err) => {
          console.log('remove err', err);
        });
    } else {
      const oauth2Client = new google.auth.OAuth2(
        api.GMAIL_CLIENT.GMAIL_CLIENT_ID,
        api.GMAIL_CLIENT.GMAIL_CLIENT_SECRET,
        urls.GMAIL_AUTHORIZE_URL
      );
      oauth2Client.setCredentials(JSON.parse(currentUser.google_refresh_token));
      const data = { oauth2Client, calendar_id, remove_id };
      await removeGoogleCalendarById(data).catch((err) => {
        console.log('event remove err', err.message);
        return res.status(400).json({
          status: false,
          error: err,
        });
      });
    }

    Appointment.deleteMany({
      user: currentUser.id,
      event_id,
    }).catch((err) => {
      console.log('appointment update err', err.message);
    });
    // const activity = new Activity({
    //   content: 'removed appointment',
    //   contacts: appointment.contact,
    //   appointments: appointment.id,
    //   user: currentUser.id,
    //   type: 'appointments',
    //   created_at: new Date(),
    //   updated_at: new Date(),
    // });

    // activity
    //   .save()
    //   .then((_activity) => {
    //     Contact.updateOne(
    //       { _id: appointment.contact },
    //       {
    //         $set: { last_activity: _activity.id },
    //       }
    //     ).catch((err) => {
    //       console.log('err', err);
    //     });
    //     const myJSON = JSON.stringify(appointment);
    //     const data = JSON.parse(myJSON);
    //     data.activity = _activity;
    //     res.send({
    //       status: true,
    //       data,
    //     });
    //   })
    //   .catch((e) => {
    //     let errors;
    //     if (e.errors) {
    //       console.log('e.errors', e.errors);
    //       errors = e.errors.map((err) => {
    //         delete err.instance;
    //         return err;
    //       });
    //     }
    //     return res.status(500).send({
    //       status: false,
    //       error: errors || e,
    //     });
    //   });
    return res.send({
      status: true,
    });
  } else {
    const appointment = await Appointment.findOne({
      user: currentUser.id,
      _id: req.params.id,
    });
    if (appointment) {
      appointment.del = true;
      appointment.updated_at = new Date();

      appointment.save();
      const activity = new Activity({
        content: 'removed appointment',
        contacts: appointment.contact,
        appointments: appointment.id,
        user: currentUser.id,
        type: 'appointments',
        created_at: new Date(),
        updated_at: new Date(),
      });

      activity
        .save()
        .then((_activity) => {
          Contact.updateOne(
            { _id: appointment.contact },
            {
              $set: { last_activity: _activity.id },
            }
          ).catch((err) => {
            console.log('err', err);
          });
          const myJSON = JSON.stringify(appointment);
          const data = JSON.parse(myJSON);
          data.activity = _activity;
          res.send({
            status: true,
            data,
          });
        })
        .catch((e) => {
          let errors;
          if (e.errors) {
            console.log('e.errors', e.errors);
            errors = e.errors.map((err) => {
              delete err.instance;
              return err;
            });
          }
          return res.status(500).send({
            status: false,
            error: errors || e,
          });
        });
    }
  }
};

const removeGoogleCalendarById = async (data) => {
  const { oauth2Client, calendar_id, remove_id } = data;
  const calendar = google.calendar({ version: 'v3', auth: oauth2Client });
  const params = {
    calendarId: calendar_id,
    eventId: remove_id,
    sendNotifications: true,
  };
  // calendar.events.delete(params, function (err) {
  //   if (err) {
  //     console.log(`There was an error contacting the Calendar service: ${err}`);
  //   }
  // });
  return new Promise((resolve, reject) => {
    calendar.events.delete(params, function (err) {
      if (err) {
        console.log(
          `There was an error contacting the Calendar service: ${err}`
        );
        reject(err);
      }
      resolve();
    });
  });
};

const updateGoogleCalendarById = async (data) => {
  const { oauth2Client, remove_id, appointment, time_zone } = data;
  const calendar = google.calendar({ version: 'v3', auth: oauth2Client });
  const attendees = [];
  if (appointment.guests) {
    for (let j = 0; j < appointment.guests.length; j++) {
      const addendee = {
        email: appointment.guests[j],
      };
      attendees.push(addendee);
    }
  }
  const event = {
    summary: appointment.title,
    location: appointment.location,
    description: appointment.description,
    start: {
      dateTime: appointment.due_start,
      timeZone: `UTC${time_zone}`,
    },
    end: {
      dateTime: appointment.due_end,
      timeZone: `UTC${time_zone}`,
    },
    attendees,
  };
  const params = {
    calendarId: appointment.calendar_id,
    eventId: remove_id,
    resource: event,
    sendNotifications: true,
  };
  return new Promise((resolve, reject) => {
    calendar.events.patch(params, function (err) {
      if (err) {
        console.log(
          `There was an error contacting the Calendar service: ${err}`
        );
        reject(err);
      }
      resolve();
    });
  });
};

const accept = async (req, res) => {
  const _appointment = await Appointment.findOne({
    _id: req.query.appointment,
  });
  const user = await User.findOne({ _id: _appointment.user });
  const { contact } = req.query;

  const msg = {
    to: user.email,
    from: mail_contents.NOTIFICATION_APPOINTMENT.MAIL,
    subject: 'Appointment Accept Notification',
    templateId: api.SENDGRID.SENDGRID_APPOINTMENT_NOTIFICATION_TEMPLATE,
    dynamic_template_data: {
      event_title: _appointment.title,
      description: _appointment.description,
      event_time: `${moment(_appointment.due_start)
        .utcOffset(user.time_zone)
        .format('dddd, MMMM Do YYYY HH:mm')} - ${moment(_appointment.due_end)
        .utcOffset(user.time_zone)
        .format('HH:mm')} UTC ${user.time_zone}`,
      event_address: _appointment.location,
      organizer: user.user_name,
      appointment_notification: `${contact} accepted the following appointment invitation`,
    },
  };

  sgMail
    .send(msg)
    .then((_res) => {
      if (_res[0].statusCode >= 200 && _res[0].statusCode < 400) {
        console.log('status', _res[0].statusCode);
        return res.send('Thanks for your submitting');
      }
      console.log('email sending err', msg.to + res[0].statusCode);
      return res.send(
        'Sorry! Something went wrong... It couldn`t be notified to appointment organizer'
      );
    })
    .catch((e) => {
      console.error(e);
      return res.send(
        'Sorry! Something went wrong... It couldn`t be notified to appointment organizer'
      );
    });
};

const decline = async (req, res) => {
  const _appointment = await Appointment.findOne({
    _id: req.query.appointment,
  });
  const user = await User.findOne({ _id: _appointment.user });
  const { contact } = req.query;

  const msg = {
    to: user.email,
    from: mail_contents.NOTIFICATION_APPOINTMENT.MAIL,
    subject: 'Appointment Decline Notification',
    templateId: api.SENDGRID.SENDGRID_APPOINTMENT_NOTIFICATION_TEMPLATE,
    dynamic_template_data: {
      event_title: _appointment.title,
      description: _appointment.description,
      event_time: `${moment(_appointment.due_start)
        .utcOffset(user.time_zone)
        .format('dddd, MMMM Do YYYY HH:mm')} - ${moment(_appointment.due_end)
        .utcOffset(user.time_zone)
        .format('HH:mm')} UTC ${user.time_zone}`,
      event_address: _appointment.location,
      organizer: user.user_name,
      appointment_notification: `${contact} declined the following appointment invitation`,
    },
  };

  sgMail
    .send(msg)
    .then((_res) => {
      if (_res[0].statusCode >= 200 && _res[0].statusCode < 400) {
        console.log('status', _res[0].statusCode);
        return res.send('Thanks for your submitting');
      }
      console.log('email sending err', msg.to + res[0].statusCode);
      return res.send(
        'Sorry! Something went wrong... It couldn`t be notified to appointment organizer'
      );
    })
    .catch((e) => {
      console.error(e);
      return res.send(
        'Sorry! Something went wrong... It couldn`t be notified to appointment organizer'
      );
    });
};

module.exports = {
  getAll,
  get,
  create,
  edit,
  remove,
  accept,
  decline,
};
