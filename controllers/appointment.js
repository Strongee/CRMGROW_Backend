const { validationResult } = require('express-validator/check');
const outlook = require('node-outlook');
const moment = require('moment-timezone');
const { google } = require('googleapis');
const sgMail = require('@sendgrid/mail');

const api = require('../config/api');
const urls = require('../constants/urls');
const time_zone = require('../constants/time_zone');
const mail_contents = require('../constants/mail_contents');
const Appointment = require('../models/appointment');
const Activity = require('../models/activity');
const Reminder = require('../models/reminder');
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
  const promise_array = [];
  const data = [];

  let { date, mode } = req.query;
  if (!mode) {
    mode = 'week';
  }

  if (!date) {
    date = moment().startOf(mode);
  } else {
    date = moment(date).startOf(mode);
  }

  if (currentUser.connect_calendar) {
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

      client
        .api('/me/calendars')
        .get()
        .then(async (outlook_calendars) => {
          const calendars = outlook_calendars.value;

          // Calendar sync works on the CalendarView endpoint
          if (calendars.length > 0) {
            for (let i = 0; i < calendars.length; i++) {
              const calendar = calendars[i];
              const promise = new Promise(async (resolve) => {
                const outlook_events = await client
                  .api(`/me/calendars/${calendar.id}/events/instances?`)
                  .get();
                if (outlook_events && outlook_events.value) {
                  const calendar_events = outlook_events.value;
                  console.log('calendar_events', calendar_events);
                  for (let i = 0; i < calendar_events.length; i++) {
                    const guests = [];
                    const contacts = [];
                    const appointments = await Appointment.find({
                      event_id: calendar_events[i].id,
                    })
                      .select('contact')
                      .populate({ path: 'contact', select: 'email' });

                    appointments.map((appointment) => {
                      contacts.push(appointment.contact);
                    });

                    if (
                      calendar_events[i].attendees &&
                      calendar_events[i].attendees.length > 0
                    ) {
                      const attendees = calendar_events[i].attendees;
                      for (let j = 0; j < attendees.length; j++) {
                        const guest = attendees[j].emailAddress.address;
                        guests.push(guest);
                      }
                    }
                    const _outlook_calendar_data = {};
                    _outlook_calendar_data.title = calendar_events[i].subject;
                    if (calendar_events[i].body) {
                      _outlook_calendar_data.description =
                        calendar_events[i].body.content;
                    } else {
                      _outlook_calendar_data.description = '';
                    }
                    if (calendar_events[i].location) {
                      _outlook_calendar_data.location =
                        calendar_events[i].location.displayName;
                    } else {
                      _outlook_calendar_data.location = '';
                    }
                    if (calendar_events[i].start) {
                      _outlook_calendar_data.due_start =
                        calendar_events[i].start.dateTime;
                      _outlook_calendar_data.time_zone =
                        calendar_events[i].start.timezone;
                      _outlook_calendar_data.due_start = moment
                        .tz(
                          _outlook_calendar_data.due_start,
                          _outlook_calendar_data.time_zone
                        )
                        .toISOString();
                    } else {
                      _outlook_calendar_data.due_start = '';
                    }
                    if (calendar_events[i].end) {
                      _outlook_calendar_data.due_end =
                        calendar_events[i].end.datetime;
                      _outlook_calendar_data.time_zone =
                        calendar_events[i].end.timezone;
                      _outlook_calendar_data.due_end = moment
                        .tz(
                          _outlook_calendar_data.due_end,
                          _outlook_calendar_data.time_zone
                        )
                        .toISOString();
                    } else {
                      _outlook_calendar_data.due_end = '';
                    }
                    _outlook_calendar_data.contacts = contacts;
                    _outlook_calendar_data.guests = guests;
                    _outlook_calendar_data.event_id = calendar_events[i].id;
                    data.push(_outlook_calendar_data);
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
      /**
      outlook.base.setApiEndpoint('https://outlook.office.com/api/v2.0');

      outlook.base.setAnchorMailbox(currentUser.connected_email);

      const endDate = moment(startDate).add(7, 'days');
      // The start and end date are passed as query parameters
      const params = {
        startDateTime: startDate.toISOString(),
        endDateTime: endDate.toISOString(),
      };

      // Set the required headers for sync
      const headers = {
        Prefer: [
          // Enables sync functionality
          'odata.track-changes',
        ],
      };

      const token = oauth2.accessToken.create({
        refresh_token: currentUser.outlook_refresh_token,
        expires_in: 0,
      });
      let accessToken;
      await new Promise((resolve, reject) => {
        token.refresh(function (error, result) {
          if (error) {
            reject(error.message);
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
        });

      // Calendar sync works on the CalendarView endpoint
      let requestUrl = `${outlook.base.apiEndpoint()}/Me/calendars`;

      let apiOptions = {
        url: requestUrl,
        token: accessToken,
      };

      outlook.base.makeApiCall(apiOptions, async function (error, response) {
        if (error) {
          console.log('err', JSON.stringify(error));
          return res.status(400).json({
            status: false,
            error,
          });
        }
        if (response.statusCode !== 200) {
          console.log(`API Call returned ${JSON.stringify(response)}`);
          return res.status(500).send({
            status: false,
            error: response.statusCode,
          });
        }
        const calendar = response.body.value;

        // Calendar sync works on the CalendarView endpoint
        if (calendar.length > 0) {
          for (let i = 0; i < calendar.length; i++) {
            requestUrl = `${outlook.base.apiEndpoint()}/Me/calendars/${
              calendar[i].Id
            }/CalendarView`;

            apiOptions = {
              url: requestUrl,
              token: accessToken,
              headers,
              query: params,
            };

            await new Promise((resolve, reject) => {
              outlook.base.makeApiCall(apiOptions, function (error, response) {
                if (error) {
                  console.log('err', JSON.stringify(error));
                  return res.status(400).json({
                    status: false,
                    error,
                  });
                }
                if (response.statusCode !== 200) {
                  console.log(`API Call returned ${JSON.stringify(response)}`);
                  return res.status(500).send({
                    status: false,
                    error: response.statusCode,
                  });
                }
                const _outlook_calendar_data_list = response.body.value;
                for (let i = 0; i < _outlook_calendar_data_list.length; i++) {
                  const guests = [];
                  if (
                    typeof _outlook_calendar_data_list[i].Attendees !==
                    'undefined'
                  ) {
                    for (
                      let j = 0;
                      j < _outlook_calendar_data_list[i].Attendees.length;
                      j++
                    ) {
                      const guest =
                        _outlook_calendar_data_list[i].Attendees[j].EmailAddress
                          .Address;
                      guests.push(guest);
                    }
                  }
                  const _outlook_calendar_data = {};
                  _outlook_calendar_data.title =
                    _outlook_calendar_data_list[i].Subject;
                  if (
                    typeof _outlook_calendar_data_list[i].Body !== 'undefined'
                  ) {
                    _outlook_calendar_data.description =
                      _outlook_calendar_data_list[i].Body.Content;
                  } else {
                    _outlook_calendar_data.description = '';
                  }
                  if (
                    typeof _outlook_calendar_data_list[i].Location !==
                    'undefined'
                  ) {
                    _outlook_calendar_data.location =
                      _outlook_calendar_data_list[i].Location.DisplayName;
                  } else {
                    _outlook_calendar_data.location = '';
                  }
                  if (
                    typeof _outlook_calendar_data_list[i].Start !== 'undefined'
                  ) {
                    _outlook_calendar_data.due_start =
                      _outlook_calendar_data_list[i].Start.DateTime;
                    _outlook_calendar_data.time_zone =
                      _outlook_calendar_data_list[i].Start.TimeZone;
                    _outlook_calendar_data.due_start = moment
                      .tz(
                        _outlook_calendar_data.due_start,
                        _outlook_calendar_data.time_zone
                      )
                      .toISOString();
                  } else {
                    _outlook_calendar_data.due_start = '';
                  }
                  if (
                    typeof _outlook_calendar_data_list[i].End !== 'undefined'
                  ) {
                    _outlook_calendar_data.due_end =
                      _outlook_calendar_data_list[i].End.DateTime;
                    _outlook_calendar_data.time_zone =
                      _outlook_calendar_data_list[i].End.TimeZone;
                    _outlook_calendar_data.due_end = moment
                      .tz(
                        _outlook_calendar_data.due_end,
                        _outlook_calendar_data.time_zone
                      )
                      .toISOString();
                  } else {
                    _outlook_calendar_data.due_end = '';
                  }
                  _outlook_calendar_data.guests = guests;
                  _outlook_calendar_data.event_id =
                    _outlook_calendar_data_list[i].Id;
                  data.push(_outlook_calendar_data);
                }
                resolve();
              });
            });
          }
          return res.send({
            status: true,
            data,
          });
        }
        requestUrl = `${outlook.base.apiEndpoint()}/Me/CalendarView`;
        apiOptions = {
          url: requestUrl,
          token: accessToken,
          headers,
          query: params,
        };

        outlook.base.makeApiCall(apiOptions, function (error, response) {
          if (error) {
            console.log('err', JSON.stringify(error));
            return res.status(400).json({
              status: false,
              error,
            });
          }
          if (response.statusCode !== 200) {
            console.log(`API Call returned ${JSON.stringify(response)}`);
            return res.status(500).send({
              status: false,
              error: response.statusCode,
            });
          }
          const _outlook_calendar_data_list = response.body.value;
          for (let i = 0; i < _outlook_calendar_data_list.length; i++) {
            const guests = [];
            if (
              typeof _outlook_calendar_data_list[i].Attendees !== 'undefined'
            ) {
              for (
                let j = 0;
                j < _outlook_calendar_data_list[i].Attendees.length;
                j++
              ) {
                const guest =
                  _outlook_calendar_data_list[i].Attendees[j].EmailAddress
                    .Address;
                guests.push(guest);
              }
            }
            const _outlook_calendar_data = {};
            _outlook_calendar_data.title =
              _outlook_calendar_data_list[i].Subject;
            if (typeof _outlook_calendar_data_list[i].Body !== 'undefined') {
              _outlook_calendar_data.description =
                _outlook_calendar_data_list[i].Body.Content;
            } else {
              _outlook_calendar_data.description = '';
            }
            if (
              typeof _outlook_calendar_data_list[i].Location !== 'undefined'
            ) {
              _outlook_calendar_data.location =
                _outlook_calendar_data_list[i].Location.DisplayName;
            } else {
              _outlook_calendar_data.location = '';
            }
            if (typeof _outlook_calendar_data_list[i].Start !== 'undefined') {
              _outlook_calendar_data.due_start =
                _outlook_calendar_data_list[i].Start.DateTime;
            } else {
              _outlook_calendar_data.due_start = '';
            }
            if (typeof _outlook_calendar_data_list[i].End !== 'undefined') {
              _outlook_calendar_data.due_end =
                _outlook_calendar_data_list[i].End.DateTime;
            } else {
              _outlook_calendar_data.due_end = '';
            }
            _outlook_calendar_data.guests = guests;
            _outlook_calendar_data.event_id = _outlook_calendar_data_list[i].Id;
            data.push(_outlook_calendar_data);
          }
          return res.send({
            status: true,
            data,
          });
        });
      });
        */
    } else {
      const oauth2Client = new google.auth.OAuth2(
        api.GMAIL_CLIENT.GMAIL_CLIENT_ID,
        api.GMAIL_CLIENT.GMAIL_CLIENT_SECRET,
        urls.GMAIL_AUTHORIZE_URL
      );

      const token = JSON.parse(currentUser.google_refresh_token);
      oauth2Client.setCredentials({ refresh_token: token.refresh_token });
      const calendar_data = {
        auth: oauth2Client,
        data,
        res,
        date,
        mode,
      };
      calendarList(calendar_data);
    }
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

const calendarList = (calendar_data) => {
  const { auth, data, res, date, mode } = calendar_data;
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
                  const recurrance_event = [];
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
                          guests.push(guest);
                        }
                      }
                      const _gmail_calendar_data = {};
                      _gmail_calendar_data.title = event.summary;
                      _gmail_calendar_data.description = event.description;
                      _gmail_calendar_data.location = event.location;
                      _gmail_calendar_data.due_start = event.start.dateTime;
                      _gmail_calendar_data.due_end = event.end.dateTime;
                      _gmail_calendar_data.guests = guests;

                      if (event.recurringEventId) {
                        recurrance_event.push({
                          id: event.recurringEventId,
                          index: data.length,
                        });
                        _gmail_calendar_data.recurrance_id =
                          event.recurringEventId;
                      }

                      _gmail_calendar_data.event_id = event.id;
                      _gmail_calendar_data.contacts = contacts;
                      _gmail_calendar_data.type = 2;
                      data.push(_gmail_calendar_data);
                    }
                    if (recurrance_event.length > 0) {
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
                          for (let j = 0; j < recurrance_event.length; j++) {
                            events.map((event) => {
                              if (event.id === recurrance_event[j].id) {
                                if (event.recurrence) {
                                  const index = recurrance_event[j].index;
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

const create = async (req, res) => {
  const { currentUser } = req;

  let event_id;

  // if (!req.body.contacts) {
  //   return res.status(400).json({
  //     status: false,
  //     error: 'Contacts required',
  //   });
  // }

  if (currentUser.connect_calendar) {
    const _appointment = req.body;
    if (currentUser.connected_email_type === 'outlook') {
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
          timeZone: `UTC${currentUser.time_zone}`,
        },
        end: {
          dateTime: _appointment.due_end,
          timeZone: `UTC${currentUser.time_zone}`,
        },
        attendees,
      };

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

      let res = await client.api('/me/events').post(newEvent);
      event_id = res.id;
    } else {
      const oauth2Client = new google.auth.OAuth2(
        api.GMAIL_CLIENT.GMAIL_CLIENT_ID,
        api.GMAIL_CLIENT.GMAIL_CLIENT_SECRET,
        urls.GMAIL_AUTHORIZE_URL
      );
      const token = JSON.parse(currentUser.google_refresh_token);
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
    const appointment = new Appointment({
      ...req.body,
      user: currentUser.id,
      type: 0,
      updated_at: new Date(),
      created_at: new Date(),
    });

    const _appointment = await appointment
      .save()
      .then()
      .catch((err) => {
        console.log('err', err);
        return res.status(500).send({
          status: false,
          error: 'internal_server_error',
        });
      });

    const due_date = new Date(_appointment.due_start);
    const due_start = new Date(_appointment.due_start)
      .toISOString()
      .replace(/-|:|\.\d\d\d/g, '');
    const due_end = new Date(
      new Date(_appointment.due_start).setDate(due_date.getDate() + 1)
    )
      .toISOString()
      .replace(/-|:|\.\d\d\d/g, '');
    const ctz = time_zone[currentUser.time_zone];

    sgMail.setApiKey(api.SENDGRID.SENDGRID_KEY);

    for (let i = 0; i < _appointment.guests.length; i++) {
      const promise = new Promise((resolve, reject) => {
        const msg = {
          to: _appointment.guests[i],
          from: currentUser.email,
          templateId: api.SENDGRID.SENDGRID_APPOITMENT_TEMPLATE,
          dynamic_template_data: {
            event_title: _appointment.title,
            description: _appointment.description,
            event_time: `${moment(_appointment.due_start)
              .utcOffset(currentUser.time_zone)
              .format('dddd, MMMM Do YYYY HH:mm')} - ${moment(
              _appointment.due_end
            )
              .utcOffset(currentUser.time_zone)
              .format('HH:mm')} UTC ${currentUser.time_zone}`,
            event_address: _appointment.location,
            organizer: currentUser.user_name,
            add_google_calendar: `<a href='${
              urls.GOOGLE_CALENDAR_URL
            }${encodeURI(
              `text=${
                _appointment.title
              }&dates=${due_start}/${due_end}&ctz=${ctz}&details=${
                _appointment.description
              }&location=${
                _appointment.location
              }&add=${_appointment.guests.slice(1)}`
            )}  style='border: 1px solid #dadce0;font-size: .875rem;letter-spacing: .25px;background: none;border-radius: 4px;color: #5f6368;cursor: pointer;font-weight: 500;height: 36px;text-decoration: none;display: inline-block;padding: 5px 5px;'>Add to my google calendar</a>`,
            accept_invitation: `<a href='${urls.ACCEPT_INVITATION_URL}contact=${_appointment.guests[i]}&appointment=${_appointment.id}' style='border: 1px solid #dadce0;font-size: .875rem;letter-spacing: .25px;background: none;border-radius: 4px;color: #5f6368;cursor: pointer;font-weight: 500;height: 36px;text-decoration: none;display: inline-block;padding: 5px 5px;'>Accept</a>`,
            decline_invitation: `<a href='${urls.DECLINE_INVITATION_URL}contact=${_appointment.guests[i]}&appointment=${_appointment.id}' style='border: 1px solid #dadce0;font-size: .875rem;letter-spacing: .25px;background: none;border-radius: 4px;color: #5f6368;cursor: pointer;font-weight: 500;height: 36px;text-decoration: none;display: inline-block;padding: 5px 5px;'>Decline</a>`,
            email_signature: currentUser.email_signature,
          },
        };
        sgMail
          .send(msg)
          .then((_res) => {
            console.log('mailres.errorcode', _res[0].statusCode);
            if (_res[0].statusCode >= 200 && _res[0].statusCode < 400) {
              console.log('status', _res[0].statusCode);
              resolve();
            }
          })
          .catch((err) => {
            console.error('err', err);
            resolve();
          });
      });
    }

    const mins = new Date(_appointment.due_start).getMinutes() - 30;
    const rdue_date = new Date(_appointment.due_start).setMinutes(mins);
    const reminder = new Reminder({
      contact: _appointment.contact,
      due_date: rdue_date,
      type: 'appointment',
      user: currentUser.id,
      appointment: _appointment.id,
      created_at: new Date(),
      updated_at: new Date(),
    });

    reminder.save().catch((err) => {
      console.log('error', err);
    });

    const activity = new Activity({
      content: 'added appointment',
      contacts: _appointment.contact,
      appointments: _appointment.id,
      user: currentUser.id,
      type: 'appointments',
      created_at: new Date(),
      updated_at: new Date(),
    });

    activity
      .save()
      .then((_activity) => {
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
        return res.send({
          status: true,
          data,
        });
      })
      .catch((err) => {
        console.log('err', err);
        return res.status(500).send({
          status: false,
          error: 'internal_server_error',
        });
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

  const event = {
    summary: appointment.title,
    location: appointment.location,
    description: appointment.description,
    start: {
      dateTime: appointment.due_start,
      timeZone: `UTC${user.time_zone}`,
    },
    end: {
      dateTime: appointment.due_end,
      timeZone: `UTC${user.time_zone}`,
    },
    attendees,
    recurrence,
  };
  return new Promise((resolve, reject) => {
    calendar.events.insert(
      {
        auth,
        calendarId: 'primary',
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

  if (currentUser.connect_calendar) {
    const _appointment = req.body;
    const event_id = _appointment.recurrence_id || req.params.id;

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

      const attendees = [];
      if (_appointment.guests) {
        for (let j = 0; j < _appointment.guests.length; j++) {
          const addendee = {
            emailAddress: {
              address: _appointment.guests[j],
            },
          };
          attendees.push(addendee);
        }
      }
      const event = {
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
          timeZone: `UTC${currentUser.time_zone}`,
        },
        end: {
          dateTime: _appointment.due_end,
          timeZone: `UTC${currentUser.time_zone}`,
        },
        attendees,
      };

      let res = await client.api(`/me/events/${event_id}`).update(event);

      // const updatePayload = {
      //   subject: _appointment.title,
      //   body: {
      //     contentType: 'HTML',
      //     content: _appointment.description,
      //   },
      //   location: {
      //     displayName: _appointment.location,
      //   },
      //   start: {
      //     dateTime: _appointment.due_start,
      //     timeZone: `UTC${currentUser.time_zone}`,
      //   },
      //   end: {
      //     dateTime: _appointment.due_end,
      //     timeZone: `UTC${currentUser.time_zone}`,
      //   },
      //   attendees,
      // };

      // const updateEventParameters = {
      //   token: accessToken,
      //   eventId: event_id,
      //   update: updatePayload,
      // };

      // outlook.base.setApiEndpoint('https://outlook.office.com/api/v2.0');
      // outlook.calendar.updateEvent(updateEventParameters, function (error) {
      //   if (error) {
      //     console.log('err', error);
      //   }
      // });
    } else {
      const oauth2Client = new google.auth.OAuth2(
        api.GMAIL_CLIENT.GMAIL_CLIENT_ID,
        api.GMAIL_CLIENT.GMAIL_CLIENT_SECRET,
        urls.GMAIL_AUTHORIZE_URL
      );

      const token = JSON.parse(currentUser.google_refresh_token);
      oauth2Client.setCredentials({ refresh_token: token.refresh_token });
      await updateGoogleCalendarById(
        oauth2Client,
        event_id,
        _appointment,
        currentUser.time_zone
      );
    }

    if (_appointment.contacts && _appointment.contacts.length > 0) {
      for (let i = 0; i < _appointment.contacts.length; i++) {
        const contact = _appointment.contacts[i];
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
      _appointment.contacts.remove_contacts &&
      _appointment.contacts.remove_contacts.length > 0
    ) {
      Appointment.updateMany(
        {
          _id: { $in: _appointment.contacts.remove_contacts },
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

  if (currentUser.connect_calendar) {
    const event_id = req.body.recurrance_id || req.params.id;
    if (currentUser.connected_email_type === 'outlook') {
      const token = oauth2.accessToken.create({
        refresh_token: currentUser.outlook_refresh_token,
        expires_in: 0,
      });
      let accessToken;

      await new Promise((resolve, reject) => {
        token.refresh(function (error, result) {
          if (error) {
            reject(error.message);
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
        });

      const deleteEventParameters = {
        token: accessToken,
        eventId: event_id,
      };

      outlook.base.setApiEndpoint('https://outlook.office.com/api/v2.0');
      outlook.calendar.deleteEvent(deleteEventParameters, function (error) {
        if (error) {
          console.log('err', error);
        }
      });
    } else {
      const oauth2Client = new google.auth.OAuth2(
        api.GMAIL_CLIENT.GMAIL_CLIENT_ID,
        api.GMAIL_CLIENT.GMAIL_CLIENT_SECRET,
        urls.GMAIL_AUTHORIZE_URL
      );
      oauth2Client.setCredentials(JSON.parse(currentUser.google_refresh_token));
      await removeGoogleCalendarById(oauth2Client, event_id).catch((err) => {
        console.log('event remove err', err.message);
        return res.status(400).json({
          status: false,
          error: err,
        });
      });
    }

    Appointment.deleteMany({
      user: currentUser.id,
      event_id: req.params.id,
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

const removeGoogleCalendarById = async (auth, event_id) => {
  const calendar = google.calendar({ version: 'v3', auth });
  const params = {
    calendarId: 'primary',
    eventId: event_id,
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

const updateGoogleCalendarById = async (
  auth,
  event_id,
  appointment,
  time_zone
) => {
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
    calendarId: 'primary',
    eventId: event_id,
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
