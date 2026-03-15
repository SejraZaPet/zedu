/**
 * LTI 1.3 Deep Linking Response Template
 *
 * Defines the JWT claims structure for an LTI Deep Linking Response.
 * Values marked "NESPECIFIKOVÁNO" must be supplied at runtime by the
 * LTI platform/tool registration configuration.
 */

export const LTI_DEEP_LINKING = {
  ltiDeepLinking: {
    claims: {
      // ── Required JWT header (for reference, not part of payload) ──
      // alg: "RS256", typ: "JWT", kid: "NESPECIFIKOVÁNO"

      // ── Required payload claims ──
      iss: "NESPECIFIKOVÁNO",
      aud: "NESPECIFIKOVÁNO",
      iat: "NESPECIFIKOVÁNO",
      exp: "NESPECIFIKOVÁNO",
      nonce: "NESPECIFIKOVÁNO",

      "https://purl.imsglobal.org/spec/lti/claim/message_type":
        "LtiDeepLinkingResponse",
      "https://purl.imsglobal.org/spec/lti/claim/version": "1.3.0",
      "https://purl.imsglobal.org/spec/lti/claim/deployment_id":
        "NESPECIFIKOVÁNO",

      // ── Deep Linking specific ──
      "https://purl.imsglobal.org/spec/lti-dl/claim/content_items": [
        {
          type: "ltiResourceLink",
          title: "{{lessonTitle}}",
          url: "https://zedu.cz/lti/launch",
          custom: {
            resource_id: "{{lessonId}}",
            resource_type: "lesson",
            subject: "{{subjectSlug}}",
          },
          lineItem: {
            scoreMaximum: 100,
            label: "{{lessonTitle}}",
            resourceId: "{{lessonId}}",
          },
          available: {
            startDateTime: "NESPECIFIKOVÁNO",
            endDateTime: "NESPECIFIKOVÁNO",
          },
          submission: {
            endDateTime: "NESPECIFIKOVÁNO",
          },
        },
      ],

      "https://purl.imsglobal.org/spec/lti-dl/claim/data":
        "NESPECIFIKOVÁNO",
    },

    unspecified: [
      "iss – Identifikátor toolu (Tool Issuer). Závisí na registraci v LMS.",
      "aud – Identifikátor platformy (LMS). Získán při LTI registraci.",
      "iat – Issued-at timestamp. Generován při vytvoření JWT.",
      "exp – Expiration timestamp. Typicky iat + 60s, konfigurovatelné.",
      "nonce – Jednorázový token proti replay útokům. Generován per-request.",
      "deployment_id – ID nasazení toolu v rámci platformy. Získán při registraci.",
      "https://purl.imsglobal.org/spec/lti-dl/claim/data – Opaque string předaný platformou v Deep Linking Request, musí být vrácen beze změny.",
      "kid (JWT header) – Key ID pro ověření podpisu. Závisí na JWKS konfiguraci toolu.",
      "custom.resource_id – Interní UUID lekce v Zedu. Generován při výběru obsahu učitelem.",
      "lineItem – Volitelný. Pokud LMS podporuje Assignment and Grade Services (AGS), umožní automatický přenos známek.",
      "available.startDateTime / endDateTime – Volitelné časové okno dostupnosti. Nastavuje učitel v LMS.",
      "submission.endDateTime – Volitelný deadline odevzdání. Nastavuje učitel v LMS.",
      "Podpisový klíč (RSA private key) – Tool musí JWT podepsat vlastním privátním klíčem. Veřejný klíč je publikován přes JWKS endpoint.",
    ],
  },
} as const;

export type LtiDeepLinking = typeof LTI_DEEP_LINKING;
