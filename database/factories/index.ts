import Factory from '@ioc:Adonis/Lucid/Factory'
import Group from 'App/Models/Group'
import User from 'App/Models/User'

export const UserFactory = Factory.define(User, ({ faker }) => {
  return {
    username: faker.person.firstName(),
    email: faker.internet.email(),
    password: faker.internet.password(),
    avatar: faker.internet.url(),
  }
}).build()

export const GroupFactory = Factory.define(Group, ({ faker }) => {
  return {
    name: faker.person.firstName(),
    description: faker.lorem.paragraph(),
    schedule: faker.date.weekday(),
    location: faker.internet.url(),
    chronicity: faker.lorem.sentence(),
  }
}).build()
