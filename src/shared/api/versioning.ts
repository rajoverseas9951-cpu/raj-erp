import { appConfig } from '../../config';

export const getVersionedApiPrefix = (version = appConfig.apiVersion): string => {
  return `${appConfig.apiPrefix}/${version}`;
};
