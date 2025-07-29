// database.js
require('dotenv').config();
const { Sequelize, DataTypes } = require('sequelize');

const sequelize = new Sequelize(
    process.env.DB_NAME,
    process.env.DB_USER,
    process.env.DB_PASSWORD,
    {
        host: process.env.DB_HOST,
        port: process.env.DB_PORT,
        dialect: 'mysql'
    }
);

const User = sequelize.define('User', {
    username: { type: DataTypes.STRING, allowNull: false, unique: true },
    password: { type: DataTypes.STRING, allowNull: false }
});

const Projeto = sequelize.define('Projeto', {
    nome: { type: DataTypes.STRING, allowNull: false },
    descricao: { type: DataTypes.TEXT }
});

const Requisito = sequelize.define('Requisito', {
    titulo: { type: DataTypes.STRING, allowNull: false },
    descricao: { type: DataTypes.TEXT, allowNull: false },
    tipo: { type: DataTypes.ENUM('Funcional', 'Não Funcional', 'História de Usuário', 'Regra de Negócio'), defaultValue: 'Funcional' },
    prioridade: { type: DataTypes.ENUM('Baixa', 'Média', 'Alta', 'Crítica'), defaultValue: 'Média' },
    status: { type: DataTypes.ENUM('A Levantar', 'Em Análise', 'Aprovado', 'Concluído'), defaultValue: 'A Levantar' }
});

const Template = sequelize.define('Template', {
    nome: { type: DataTypes.STRING, allowNull: false, unique: true },
    isNative: { type: DataTypes.BOOLEAN, defaultValue: false }
});

const TemplateRequisito = sequelize.define('TemplateRequisito', {
    titulo: { type: DataTypes.STRING, allowNull: false },
    descricao: { type: DataTypes.TEXT, allowNull: false },
    tipo: { type: DataTypes.ENUM('Funcional', 'Não Funcional', 'História de Usuário', 'Regra de Negócio') },
    prioridade: { type: DataTypes.ENUM('Baixa', 'Média', 'Alta', 'Crítica') }
}, { timestamps: false });

User.hasMany(Projeto, { foreignKey: 'userId', onDelete: 'CASCADE' });
Projeto.belongsTo(User, { foreignKey: 'userId' });

Projeto.hasMany(Requisito, { foreignKey: 'projetoId', onDelete: 'CASCADE' });
Requisito.belongsTo(Projeto, { foreignKey: 'projetoId' });

Template.hasMany(TemplateRequisito, { foreignKey: 'templateId', onDelete: 'CASCADE' });
TemplateRequisito.belongsTo(Template, { foreignKey: 'templateId' });

const db = {
    sequelize, User, Projeto, Requisito, Template, TemplateRequisito,
    sync: () => sequelize.sync({ alter: true })
};

module.exports = db;