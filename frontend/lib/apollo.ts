import { ApolloClient, InMemoryCache, HttpLink } from '@apollo/client'

export const apolloClient = new ApolloClient({
  link: new HttpLink({
    uri: process.env.NEXT_PUBLIC_SUBGRAPH_URL ?? 'https://api.studio.thegraph.com/query/1748822/sentinel/v0.0.1',
  }),
  cache: new InMemoryCache(),
})
