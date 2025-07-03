export interface KnowledgeMetadata {
  question: string;
  source: string;
  summary: string;
  tags: string[];
  text: string;
}

export interface QueryMatch {
  id: string;
  score: number;
  metadata: KnowledgeMetadata;
}

export class QueryResponseDto {
  matches: QueryMatch[];
  userQuestion: string;
  timestamp: Date;

  constructor(matches: QueryMatch[], userQuestion: string) {
    this.matches = matches;
    this.userQuestion = userQuestion;
    this.timestamp = new Date();
  }
}
