export interface OrgNode {
  id: string;
  name: string;
  title?: string;
  slackId: string;
  profilePicture?: string;
  children?: OrgNode[];
  originalChildren?: OrgNode[];
  expandedChildrenSlackIds?: string[];
  department?: string;
  location?: string;
  role?: string;
  team?: string;
  email?: string;
}

export interface OrgUser {
  id: string;
  name: string;
  title?: string;
  slackId: string;
  profilePicture?: string;
  department?: string;
  location?: string;
  role?: string;
  team?: string;
  email?: string;
  fname?: string;
  lname?: string;
}

export interface OrgChartDisplayFlags {
  showTitle: boolean;
  showLocation: boolean;
  showRole: boolean;
  showDepartment: boolean;
  showTeam: boolean;
}

export interface OrgChartResponse {
  dataSource: OrgNode;
  users: OrgUser[];
  slackIdsInChain: string[];
  showTitle: boolean;
  showLocation: boolean;
  showRole: boolean;
  showDepartment: boolean;
  showTeam: boolean;
}

export interface SearchMatch {
  user: OrgUser;
  matchedOn: string[];
  highlightedText?: string;
}






