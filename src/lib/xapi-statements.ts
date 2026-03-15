/**
 * xAPI Statement Templates
 *
 * Maps internal platform events to xAPI-compliant statement templates.
 * Actor is pseudonymous by default (SHA-256 hash of user ID).
 * All verb IRIs follow ADL / cmi5 / Activity Streams conventions.
 */

export const XAPI_EVENT_MAP = {
  xapi: {
    profileNote:
      "Actor.account.name MUST be a pseudonymous identifier (e.g. SHA-256 of user_id). Never include real name or email unless the teacher explicitly enables identified mode.",

    eventMap: [
      // ── joined_session ──────────────────────────────
      {
        event: "joined_session",
        statementTemplate: {
          actor: {
            objectType: "Agent",
            account: {
              homePage: "https://zedu.cz",
              name: "{{pseudonymId}}",
            },
          },
          verb: {
            id: "http://activitystrea.ms/join",
            display: { "cs-CZ": "připojil/a se", "en-US": "joined" },
          },
          object: {
            objectType: "Activity",
            id: "https://zedu.cz/sessions/{{sessionId}}",
            definition: {
              type: "http://adlnet.gov/expapi/activities/meeting",
              name: { "cs-CZ": "{{sessionTitle}}", "en-US": "Live session" },
              description: {
                "cs-CZ": "Živá výuková session řízená učitelem.",
              },
            },
          },
          result: null,
          context: {
            contextActivities: {
              grouping: [
                {
                  id: "https://zedu.cz/classes/{{classId}}",
                  definition: {
                    type: "http://adlnet.gov/expapi/activities/group",
                    name: { "cs-CZ": "{{className}}" },
                  },
                },
              ],
            },
            extensions: {
              "https://zedu.cz/xapi/ext/joinMethod": "{{code|qr}}",
              "https://zedu.cz/xapi/ext/privacyMode": "{{anonymous|identified}}",
            },
          },
        },
      },

      // ── started_activity ────────────────────────────
      {
        event: "started_activity",
        statementTemplate: {
          actor: {
            objectType: "Agent",
            account: {
              homePage: "https://zedu.cz",
              name: "{{pseudonymId}}",
            },
          },
          verb: {
            id: "http://adlnet.gov/expapi/verbs/initialized",
            display: { "cs-CZ": "zahájil/a", "en-US": "initialized" },
          },
          object: {
            objectType: "Activity",
            id: "https://zedu.cz/activities/{{activityId}}",
            definition: {
              type: "http://adlnet.gov/expapi/activities/assessment",
              name: { "cs-CZ": "{{activityTitle}}" },
              description: { "cs-CZ": "{{activityType}} aktivita." },
              extensions: {
                "https://zedu.cz/xapi/ext/activityType": "{{quiz|matching|flashcards|...}}",
              },
            },
          },
          result: null,
          context: {
            contextActivities: {
              parent: [
                {
                  id: "https://zedu.cz/lessons/{{lessonId}}",
                  definition: {
                    type: "http://adlnet.gov/expapi/activities/lesson",
                    name: { "cs-CZ": "{{lessonTitle}}" },
                  },
                },
              ],
            },
            extensions: {
              "https://zedu.cz/xapi/ext/attemptNumber": "{{attemptNumber}}",
            },
          },
        },
      },

      // ── answered_question ───────────────────────────
      {
        event: "answered_question",
        statementTemplate: {
          actor: {
            objectType: "Agent",
            account: {
              homePage: "https://zedu.cz",
              name: "{{pseudonymId}}",
            },
          },
          verb: {
            id: "http://adlnet.gov/expapi/verbs/answered",
            display: { "cs-CZ": "odpověděl/a", "en-US": "answered" },
          },
          object: {
            objectType: "Activity",
            id: "https://zedu.cz/activities/{{activityId}}/questions/{{questionIndex}}",
            definition: {
              type: "http://adlnet.gov/expapi/activities/cmi.interaction",
              interactionType: "{{choice|matching|true-false|fill-in|sequencing}}",
              name: { "cs-CZ": "Otázka {{questionIndex}}" },
              correctResponsesPattern: ["{{correctPattern}}"],
            },
          },
          result: {
            success: "{{boolean}}",
            score: {
              scaled: "{{0.0-1.0}}",
              raw: "{{rawScore}}",
              min: 0,
              max: "{{maxScore}}",
            },
            duration: "{{ISO8601duration}}",
            response: "{{studentResponse}}",
          },
          context: {
            contextActivities: {
              parent: [
                {
                  id: "https://zedu.cz/activities/{{activityId}}",
                  definition: {
                    type: "http://adlnet.gov/expapi/activities/assessment",
                  },
                },
              ],
              grouping: [
                {
                  id: "https://zedu.cz/sessions/{{sessionId}}",
                  definition: {
                    type: "http://adlnet.gov/expapi/activities/meeting",
                  },
                },
              ],
            },
            extensions: {
              "https://zedu.cz/xapi/ext/responseTimeMs": "{{responseTimeMs}}",
            },
          },
        },
      },

      // ── completed_lesson ────────────────────────────
      {
        event: "completed_lesson",
        statementTemplate: {
          actor: {
            objectType: "Agent",
            account: {
              homePage: "https://zedu.cz",
              name: "{{pseudonymId}}",
            },
          },
          verb: {
            id: "http://adlnet.gov/expapi/verbs/completed",
            display: { "cs-CZ": "dokončil/a", "en-US": "completed" },
          },
          object: {
            objectType: "Activity",
            id: "https://zedu.cz/lessons/{{lessonId}}",
            definition: {
              type: "http://adlnet.gov/expapi/activities/lesson",
              name: { "cs-CZ": "{{lessonTitle}}" },
            },
          },
          result: {
            completion: true,
            success: "{{boolean|null}}",
            score: {
              scaled: "{{0.0-1.0}}",
              raw: "{{totalScore}}",
              min: 0,
              max: "{{totalMaxScore}}",
            },
            duration: "{{ISO8601duration}}",
          },
          context: {
            contextActivities: {
              grouping: [
                {
                  id: "https://zedu.cz/subjects/{{subjectSlug}}",
                  definition: {
                    type: "http://adlnet.gov/expapi/activities/course",
                    name: { "cs-CZ": "{{subjectLabel}}" },
                  },
                },
              ],
            },
            extensions: {
              "https://zedu.cz/xapi/ext/activitiesCompleted": "{{count}}",
              "https://zedu.cz/xapi/ext/activitiesTotal": "{{total}}",
              "https://zedu.cz/xapi/ext/privacyMode": "{{anonymous|identified}}",
            },
          },
        },
      },
    ],
  },
} as const;

export type XapiEventMap = typeof XAPI_EVENT_MAP;
