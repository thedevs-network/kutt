import { Handler, Request } from "express";
import URL from "url";

import { generateShortLink, generateId } from "../utils";
import {
  getLinksQuery,
  getTotalQuery,
  findLinkQuery,
  createLinkQuery
} from "../queries/link";
import {
  cooldownCheck,
  malwareCheck,
  urlCountsCheck,
  checkBannedDomain,
  checkBannedHost
} from "../controllers/validateBodyController";

export const getLinks: Handler = async (req, res) => {
  const { limit, skip, search, all } = req.query;
  const userId = req.user.id;

  const [links, total] = await Promise.all([
    getLinksQuery({ all, limit, search, skip, userId }),
    getTotalQuery({ all, search, userId })
  ]);

  const data = links.map(link => ({
    ...link,
    id: link.uuid,
    password: !!link.password,
    link: generateShortLink(link.address, link.domain)
  }));

  return res.send({
    total,
    limit,
    skip,
    data
  });
};

interface CreateLinkReq extends Request {
  body: {
    reuse?: boolean;
    password?: string;
    customurl?: string;
    domain?: Domain;
    target: string;
  };
}

export const createLink: Handler = async (req: CreateLinkReq, res) => {
  const { reuse, password, customurl, target, domain } = req.body;
  const domainId = domain ? domain.id : null;
  const domainAddress = domain ? domain.address : null;

  try {
    const targetDomain = URL.parse(target).hostname;

    const queries = await Promise.all([
      process.env.GOOGLE_SAFE_BROWSING_KEY && cooldownCheck(req.user),
      process.env.GOOGLE_SAFE_BROWSING_KEY && malwareCheck(req.user, target),
      req.user && urlCountsCheck(req.user),
      reuse &&
        findLinkQuery({
          target,
          userId: req.user.id,
          domainId
        }),
      customurl &&
        findLinkQuery({
          address: customurl,
          domainId
        }),
      !customurl && generateId(domainId),
      checkBannedDomain(targetDomain),
      checkBannedHost(targetDomain)
    ]);

    // if "reuse" is true, try to return
    // the existent URL without creating one
    if (queries[3]) {
      const { domain_id: d, user_id: u, ...currentLink } = queries[3];
      const link = generateShortLink(currentLink.address, req.user.domain);
      const data = {
        ...currentLink,
        id: currentLink.uuid,
        password: !!currentLink.password,
        link
      };
      return res.json(data);
    }

    // Check if custom link already exists
    if (queries[4]) {
      throw new Error("Custom URL is already in use.");
    }

    // Create new link
    const address = customurl || queries[5];
    const link = await createLinkQuery({
      password,
      address,
      domainAddress,
      domainId,
      target
    });

    if (!req.user && Number(process.env.NON_USER_COOLDOWN)) {
      // addIP(req.realIP);
    }

    return res.json({ ...link, id: link.uuid });
  } catch (error) {
    return res.status(400).json({ error: error.message });
  }
};
